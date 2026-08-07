import type { Member, Organization, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, OrganizationTagFactory, RegistrationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { getStatisticsConnection } from './connection.js';
import { syncStatistics, syncStatisticsDeletes } from './sync.js';
import { readSyncState } from './sync-state.js';

async function statisticsRows(table: string, id?: string): Promise<Record<string, any>[]> {
    const connection = getStatisticsConnection();
    const [rows] = await connection.select(
        `SELECT * FROM ${connection.escapeId(table)}` + (id ? ' WHERE `id` = ?' : ''),
        id ? [id] : [],
        { nestTables: false },
    );
    return rows as unknown as Record<string, any>[];
}

describe('statistics sync', () => {
    let organization: Organization;
    let member: Member;
    let registration: Registration;
    let period: RegistrationPeriod;

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({}).create();
        organization = await new OrganizationFactory({ period }).create();
        const group = await new GroupFactory({ organization }).create();
        member = await new MemberFactory({ organization, birthDay: { year: 2011, month: 5, day: 17 } }).create();
        registration = await new RegistrationFactory({ member, group }).create();

        await syncStatistics();
    });

    it('copies a member without any of its personal data', async () => {
        const [row] = await statisticsRows('members', member.id);

        expect(row).toBeDefined();
        expect(row.birthYear).toBe(2011);
        expect(Object.keys(row).sort()).toEqual(['birthYear', 'createdAt', 'gender', 'id', 'lastRegisteredAt', 'organizationId', 'postalCode', 'source', 'updatedAt']);
        expect(JSON.stringify(row)).not.toContain(member.details.firstName);
    });

    it('copies the registration, so a member can hold several', async () => {
        const [row] = await statisticsRows('registrations', registration.id);

        expect(row).toBeDefined();
        expect(row.memberId).toBe(member.id);
        expect(row.groupId).toBe(registration.groupId);
    });

    it('copies the organization with only its postal code', async () => {
        const [row] = await statisticsRows('organizations', organization.id);

        expect(row).toBeDefined();
        expect(row.name).toBe(organization.name);
        expect(row.postalCode).toBe(organization.address.postalCode);
        expect(row.city).toBe(organization.address.city);
        expect(JSON.stringify(row)).not.toContain(organization.address.street);
    });

    it('records a watermark it can resume from', async () => {
        const state = await readSyncState('members');

        expect(state.watermark).toBeInstanceOf(Date);
        expect(state.lastSucceededAt).toBeInstanceOf(Date);
    });

    it('picks up an update to a row it already synced', async () => {
        member.details.birthDay = new Date(2009, 2, 3);
        await member.save();

        await syncStatistics();

        expect((await statisticsRows('members', member.id))[0].birthYear).toBe(2009);
    });

    it('writes the same rows again without complaining, so a repeated run is harmless', async () => {
        await syncStatistics();
        await syncStatistics();

        expect(await statisticsRows('members', member.id)).toHaveLength(1);
        expect(await statisticsRows('registrations', registration.id)).toHaveLength(1);
    });

    it('marks every row it writes as its own', async () => {
        expect((await statisticsRows('members', member.id))[0].source).toBe('sync');
    });

    it('removes a row of a live period once its source row is gone', async () => {
        const deletedId = registration.id;
        await registration.delete();

        // An incremental pass has nothing to notice: the row is simply gone from the source.
        await syncStatistics();
        expect(await statisticsRows('registrations', deletedId)).toHaveLength(1);

        await syncStatisticsDeletes();

        expect(await statisticsRows('registrations', deletedId)).toHaveLength(0);
    });

    it('keeps a member whose source row is gone, because deleting one cascades into settled years', async () => {
        const orphan = await new MemberFactory({ organization }).create();
        await syncStatistics();
        await orphan.delete();

        await syncStatisticsDeletes();

        expect(await statisticsRows('members', orphan.id)).toHaveLength(1);
    });

    describe('a frozen period', () => {
        let frozenPeriod: RegistrationPeriod;
        let frozenRegistration: Registration;

        beforeAll(async () => {
            frozenPeriod = await new RegistrationPeriodFactory({}).create();
            const group = await new GroupFactory({ organization }).create();
            group.periodId = frozenPeriod.id;
            await group.save();
            frozenRegistration = await new RegistrationFactory({ member, group }).create();
            frozenRegistration.periodId = frozenPeriod.id;
            await frozenRegistration.save();

            await syncStatistics();
            // Settle the period, as an operator would once its numbers are final.
            await getStatisticsConnection().update('UPDATE `registration_periods` SET `cutoffAt` = ? WHERE `id` = ?', [new Date(Date.now() - 1000), frozenPeriod.id]);
        });

        it('is not rewritten by the sync when the source changes', async () => {
            const before = (await statisticsRows('registrations', frozenRegistration.id))[0];

            frozenRegistration.waitingList = !before.waitingList;
            await frozenRegistration.save();
            await syncStatistics();

            expect((await statisticsRows('registrations', frozenRegistration.id))[0].waitingList).toBe(before.waitingList);
        });

        it('keeps its rows when the source is deleted, so the settled numbers stay', async () => {
            await frozenRegistration.delete();

            await syncStatistics();
            await syncStatisticsDeletes();

            expect(await statisticsRows('registrations', frozenRegistration.id)).toHaveLength(1);
        });
    });

    describe('netwerk membership', () => {
        it('is recorded against the period the organization is in', async () => {
            const tag = await new OrganizationTagFactory({}).create();
            organization.meta.tags = [tag.id];
            await organization.save();

            await syncStatistics();

            const links = await statisticsRows('_organizations_organization_tags');
            const link = links.find(row => row.organizationsId === organization.id && row.organizationTagsId === tag.id);
            expect(link).toBeDefined();
            expect(link!.periodId).toBe(organization.periodId);
        });

        it('leaves the netwerk of a settled year alone when the organization moves', async () => {
            const settledPeriod = await new RegistrationPeriodFactory({}).create();
            const tag = await new OrganizationTagFactory({}).create();
            const connection = getStatisticsConnection();

            // Get the period and the tag into the statistics database first: the link points at both.
            await syncStatistics();

            // A link as it was recorded while that year was still live, then the year is settled.
            await connection.insert(
                'INSERT INTO `_organizations_organization_tags` (`organizationsId`, `organizationTagsId`, `periodId`, `source`) VALUES (?, ?, ?, ?)',
                [organization.id, tag.id, settledPeriod.id, 'sync'],
            );
            await connection.update('UPDATE `registration_periods` SET `cutoffAt` = ? WHERE `id` = ?', [new Date(Date.now() - 1000), settledPeriod.id]);

            // The organization moves to another netwerk entirely.
            const moved = await new OrganizationTagFactory({}).create();
            organization.meta.tags = [moved.id];
            await organization.save();
            await syncStatistics();

            const links = await statisticsRows('_organizations_organization_tags');
            expect(links.some(row => row.periodId === settledPeriod.id && row.organizationTagsId === tag.id)).toBe(true);
            expect(links.some(row => row.periodId === organization.periodId && row.organizationTagsId === moved.id)).toBe(true);
        });
    });

    it('never deletes rows that came from an import, which have no source row to check against', async () => {
        const connection = getStatisticsConnection();
        // The statistics database is kept between runs, so start from a known state.
        await connection.delete('DELETE FROM `members` WHERE `id` = ?', ['imported-member-1']);
        await connection.insert(
            'INSERT INTO `members` (`id`, `birthYear`, `gender`, `createdAt`, `updatedAt`, `source`) VALUES (?, ?, ?, ?, ?, ?)',
            ['imported-member-1', 2004, 'Female', new Date(), new Date(), 'import'],
        );

        await syncStatisticsDeletes();

        expect(await statisticsRows('members', 'imported-member-1')).toHaveLength(1);
    });
});
