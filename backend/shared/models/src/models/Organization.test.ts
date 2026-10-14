import { Database } from '@simonbackx/simple-database';
import { EventFactory } from '../factories/EventFactory.js';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { Organization } from './Organization.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { OrganizationRegistrationPeriod } from './OrganizationRegistrationPeriod.js';
import { RegistrationPeriodFactory } from '../factories/RegistrationPeriodFactory.js';
import { OrganizationRegistrationPeriodSettings, SetupSteps } from '@stamhoofd/structures';

describe('Organization.getPeriod', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('Creates a missing period with defaults and caches it', async () => {
        const organization = await new OrganizationFactory({}).create();
        const period = await organization.getPeriod();
        expect(period.organizationId).toBe(organization.id);
        expect(period.periodId).toBe(organization.periodId);
        expect(period.settings).toEqual(OrganizationRegistrationPeriodSettings.create({}));
        expect(period.setupSteps).toEqual(SetupSteps.create({}));
        expect(await OrganizationRegistrationPeriod.getByID(period.id, true)).toMatchObject({
            settings: period.settings,
            setupSteps: period.setupSteps,
            createdAt: period.createdAt,
            updatedAt: period.updatedAt,
        });
        const lookup = vi.spyOn(OrganizationRegistrationPeriod, 'select');
        expect(await organization.getPeriod()).toBe(period);
        expect(lookup).not.toHaveBeenCalled();
    });

    test('Preserves an existing period and the database case-insensitive identity', async () => {
        const organization = await new OrganizationFactory({}).create();
        const existing = new OrganizationRegistrationPeriod();
        existing.organizationId = organization.id;
        existing.periodId = organization.periodId;
        existing.settings.rootCategoryId = 'existing-category';
        existing.createdAt = new Date('2020-01-01T00:00:00Z');
        await existing.save();
        organization.id = organization.id.toUpperCase();
        organization.periodId = organization.periodId.toUpperCase();
        const save = vi.spyOn(OrganizationRegistrationPeriod.prototype, 'save');
        const period = await organization.getPeriod();
        expect(period).toMatchObject({
            id: existing.id,
            settings: existing.settings,
            setupSteps: existing.setupSteps,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
        });
        expect(save).not.toHaveBeenCalled();
        expect(await organization.getPeriod()).toBe(period);
    });

    test('Different organizations and periods remain independent', async () => {
        const firstPeriod = await new RegistrationPeriodFactory({}).create();
        const secondPeriod = await new RegistrationPeriodFactory({}).create();
        const first = await new OrganizationFactory({ period: firstPeriod }).create();
        const second = await new OrganizationFactory({ period: firstPeriod }).create();
        const otherPeriodCaller = await Organization.getByID(first.id, true);
        otherPeriodCaller.periodId = secondPeriod.id;
        const periods = await Promise.all([first.getPeriod(), second.getPeriod(), otherPeriodCaller.getPeriod()]);
        expect(new Set(periods.map(period => period.id)).size).toBe(3);
        expect(periods.map(period => [period.organizationId, period.periodId])).toEqual([
            [first.id, firstPeriod.id],
            [second.id, firstPeriod.id],
            [first.id, secondPeriod.id],
        ]);
        expect(await otherPeriodCaller.getPeriod()).toBe(periods[2]);
    });

    test('Propagates creation failures when no association exists and allows retrying', async () => {
        const organization = await new OrganizationFactory({}).create();
        const error = new Error('Database unavailable');
        const save = vi.spyOn(OrganizationRegistrationPeriod.prototype, 'save').mockRejectedValueOnce(error);
        await expect(organization.getPeriod()).rejects.toBe(error);
        expect(save).toHaveBeenCalledTimes(1);
        expect((await organization.getPeriod()).periodId).toBe(organization.periodId);
        expect(save).toHaveBeenCalledTimes(2);
    });

    test('Recovers an existing association without inspecting the save error', async () => {
        const organization = await new OrganizationFactory({}).create();
        const save = OrganizationRegistrationPeriod.prototype.save;
        let winningId: string | undefined;
        const saveAttempt = vi.spyOn(OrganizationRegistrationPeriod.prototype, 'save').mockImplementation(async function (...args) {
            this.settings.rootCategoryId = 'winning-category';
            await save.apply(this, args);
            winningId = this.id;
            throw new Error('Connection lost after insert');
        });
        const period = await organization.getPeriod();
        expect(saveAttempt).toHaveBeenCalledTimes(1);
        expect(period.id).toBe(winningId);
        expect(period.settings.rootCategoryId).toBe('winning-category');
        expect(await organization.getPeriod()).toBe(period);
    });

    test('Competing callers on independent connections return the winning period without overwriting it', async () => {
        const organization = await new OrganizationFactory({}).create();
        const otherCaller = await Organization.getByID(organization.id, true);
        const database = Database.instance;
        const connections = await Promise.all([database.getConnection(), database.getConnection()]);
        const insert = database.insert.bind(database);
        let releaseInserts!: () => void;
        const bothAbsent = new Promise<void>((resolve) => { releaseInserts = resolve; });
        let releaseLoser!: () => void;
        const winnerCommitted = new Promise<void>((resolve) => { releaseLoser = resolve; });
        let arrivals = 0;
        let failedInserts = 0;
        const rootCategoryId = 'winning-category';
        vi.spyOn(database, 'insert').mockImplementation(async (query, values, connection) => {
            if (!query.startsWith('INSERT INTO `organization_registration_periods`')) {
                return insert(query, values, connection);
            }
            const caller = arrivals++;
            if (arrivals === 2) {
                releaseInserts();
            }
            await bothAbsent;
            if (caller === 0) {
                try {
                    const result = await insert(query, values, connections[caller]);
                    const settings = JSON.parse(values[0].settings);
                    settings.value.rootCategoryId = rootCategoryId;
                    await database.update('UPDATE `organization_registration_periods` SET `settings` = ? WHERE `id` = ?', [JSON.stringify(settings), values[0].id], connections[caller]);
                    return result;
                }
                finally {
                    releaseLoser();
                }
            }
            await winnerCommitted;
            try {
                return await insert(query, values, connections[caller]);
            }
            catch (error) {
                failedInserts++;
                throw error;
            }
        });

        try {
            const results = await Promise.allSettled([organization.getPeriod(), otherCaller.getPeriod()]);
            expect(arrivals).toBe(2);
            expect(failedInserts).toBe(1);
            expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
            const periods = results.map(result => {
                if (result.status === 'rejected') {
                    throw result.reason;
                }
                return result.value;
            });
            expect(periods[0].id).toBe(periods[1].id);
            const rows = await OrganizationRegistrationPeriod.select()
                .where('organizationId', organization.id)
                .andWhere('periodId', organization.periodId)
                .fetch();
            expect(rows).toHaveLength(1);
            expect(rows[0].settings.rootCategoryId).toBe(rootCategoryId);
            expect(periods.map(period => period.settings.rootCategoryId)).toContain(rootCategoryId);
            expect(await organization.getPeriod()).toBe(periods[0]);
            expect(await otherCaller.getPeriod()).toBe(periods[1]);
        }
        finally {
            connections.forEach(connection => connection.release());
        }
    });
});

async function getHasFutureEvents(organization: Organization): Promise<boolean> {
    const fetched = await Organization.getByID(organization.id, true);
    return fetched.hasFutureEvents;
}

describe('Organization.updateFutureEventsForOrganizations', () => {
    // The shared test setup never clears the events table, so make sure each test
    // starts without leftover events (a global event would otherwise poison every test).
    beforeEach(async () => {
        await Database.delete('DELETE FROM `events`');
    });
    test('Marks an organization without events as not having future events', async () => {
        const organization = await new OrganizationFactory({}).create();

        await Organization.updateFutureEventsForOrganizations([organization.id]);

        expect(await getHasFutureEvents(organization)).toBe(false);
    });

    test('Marks an organization with a future event as having future events', async () => {
        const organization = await new OrganizationFactory({}).create();
        organization.hasFutureEvents = false;
        await organization.save();

        await new EventFactory({
            organization,
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }).create();

        await Organization.updateFutureEventsForOrganizations([organization.id]);

        expect(await getHasFutureEvents(organization)).toBe(true);
    });

    test('Does not count events that ended more than 2 months ago', async () => {
        const organization = await new OrganizationFactory({}).create();

        await new EventFactory({
            organization,
            endDate: new Date(Date.now() - 2 * 31 * 24 * 60 * 60 * 1000),
        }).create();

        await Organization.updateFutureEventsForOrganizations([organization.id]);

        expect(await getHasFutureEvents(organization)).toBe(false);
    });

    test('A global event (without an organization) counts towards every organization in platform mode', async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        const organizationA = await new OrganizationFactory({}).create();
        const organizationB = await new OrganizationFactory({}).create();
        organizationA.hasFutureEvents = false;
        organizationB.hasFutureEvents = false;
        await organizationA.save();
        await organizationB.save();

        await new EventFactory({
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }).create();

        await Organization.updateFutureEventsForOrganizations('all');

        expect(await getHasFutureEvents(organizationA)).toBe(true);
        expect(await getHasFutureEvents(organizationB)).toBe(true);
    });

    test('A global event (without an organization) does not count towards every organization in organization mode', async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        const organizationA = await new OrganizationFactory({}).create();
        const organizationB = await new OrganizationFactory({}).create();
        organizationA.hasFutureEvents = false;
        organizationB.hasFutureEvents = false;
        await organizationA.save();
        await organizationB.save();

        await new EventFactory({
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }).create();

        await Organization.updateFutureEventsForOrganizations('all');

        expect(await getHasFutureEvents(organizationA)).toBe(false);
        expect(await getHasFutureEvents(organizationB)).toBe(false);
    });

    test('Only updates the requested organizations', async () => {
        const organizationA = await new OrganizationFactory({}).create();
        const organizationB = await new OrganizationFactory({}).create();

        await Organization.updateFutureEventsForOrganizations([organizationA.id]);

        expect(await getHasFutureEvents(organizationA)).toBe(false);
        expect(await getHasFutureEvents(organizationB)).toBe(true);
    });

    test('Updates all', async () => {
        const organizationA = await new OrganizationFactory({}).create();
        const organizationB = await new OrganizationFactory({}).create();

        await Organization.updateFutureEventsForOrganizations('all');

        expect(await getHasFutureEvents(organizationA)).toBe(false);
        expect(await getHasFutureEvents(organizationB)).toBe(false);
    });

    test('Does nothing when passed an empty list', async () => {
        const organization = await new OrganizationFactory({}).create();

        await expect(Organization.updateFutureEventsForOrganizations([])).resolves.toBeUndefined();

        expect(await getHasFutureEvents(organization)).toBe(true);
    });
});
