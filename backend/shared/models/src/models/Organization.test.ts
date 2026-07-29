import { Database } from '@simonbackx/simple-database';
import { AccessRight, PermissionLevel, PermissionRoleDetailed, Permissions } from '@stamhoofd/structures';
import { EventFactory } from '../factories/EventFactory.js';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { UserFactory } from '../factories/UserFactory.js';
import { Organization } from './Organization.js';
import { TestUtils } from '@stamhoofd/test-utils';

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

describe('Organization admin recipients', () => {
    async function createOrganizationWithAdmins() {
        const financeRole = PermissionRoleDetailed.create({
            name: 'financial director',
            accessRights: [AccessRight.OrganizationFinanceDirector],
        });

        const organization = await new OrganizationFactory({ roles: [financeRole] }).create();

        const fullAdmin = await new UserFactory({
            organization,
            email: 'full-admin@example.com',
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const financeAdmin = await new UserFactory({
            organization,
            email: 'finance-admin@example.com',
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [financeRole],
            }),
        }).create();

        return { organization, fullAdmin, financeAdmin };
    }

    test('The finance admin recipients include a financial director without full access', async () => {
        const { organization, fullAdmin, financeAdmin } = await createOrganizationWithAdmins();

        const emails = (await organization.getFinanceAdminRecipients()).map(r => r.email);

        expect(emails).toIncludeSameMembers([fullAdmin.email, financeAdmin.email]);
    });

    test('The regular admin recipients only include full admins', async () => {
        const { organization, fullAdmin } = await createOrganizationWithAdmins();

        const emails = (await organization.getAdminRecipients()).map(r => r.email);

        expect(emails).toIncludeSameMembers([fullAdmin.email]);
    });
});
