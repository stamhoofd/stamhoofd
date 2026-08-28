import type { Organization, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory, Member, MemberFactory, MemberPlatformMembership, OrganizationFactory, OrganizationTagFactory, Platform, RegistrationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { BooleanStatus, DefaultAgeGroup, FinancialSupportSettings, Gender, PlatformMembershipType } from '@stamhoofd/structures';
import { getStatisticsConnection } from './database.js';
import { runStatisticsCycle, syncStatistics, syncStatisticsDeletes } from './sync.js';
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
    let ageGroup: DefaultAgeGroup;

    beforeAll(async () => {
        // A tak on the platform, so there is a piece of configuration for the reports to group by.
        const platform = await Platform.getForEditing();
        ageGroup = DefaultAgeGroup.create({ names: ['Welpen'], minAge: 7, maxAge: 10 });
        platform.config.defaultAgeGroups = [ageGroup];
        await platform.save();
        await Platform.clearCache();

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
        expect(row.birthDate).toEqual(new Date(Date.UTC(2011, 4, 17)));
        expect(Object.keys(row).sort()).toEqual(['birthDate', 'createdAt', 'gender', 'id', 'lastRegisteredAt', 'organizationId', 'periodId', 'postalCode', 'source', 'updatedAt']);
        expect(JSON.stringify(row)).not.toContain(member.details.firstName);
    });

    it('writes the member against the period their registration is in', async () => {
        const rows = await statisticsRows('members', member.id);

        expect(rows.map(row => row.periodId)).toContain(registration.periodId);
    });

    it('writes no member row for a member without a registration, since nothing counts one', async () => {
        const orphan = await new MemberFactory({ organization }).create();

        await syncStatistics();

        expect(await statisticsRows('members', orphan.id)).toHaveLength(0);
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

    /**
     * The koepel's own organization, which the jeugdbewegingen report delivers as the bovenlokale
     * ondersteuningsstructuur. Nothing else in the administration tells that organization apart from
     * a local group, so the pointer on the platform record is what the report has to read.
     */
    it('writes the platform with the organization it runs itself', async () => {
        const platform = await Platform.getForEditing();
        platform.membershipOrganizationId = organization.id;
        await platform.save();
        await Platform.clearCache();

        await syncStatistics();

        const [row] = await statisticsRows('platform', platform.id);
        expect(row).toBeDefined();
        expect(row.name).toBe(platform.config.name);
        expect(row.membershipOrganizationId).toBe(organization.id);
    });

    /**
     * What a tak counts as -- kinderen, leiding or volwassenen -- is not in this database at all. The
     * platform configuration has no such field and the ages do not answer it, so the reports name
     * their takken by id themselves, in `report/includes/<env>/tak-categorie.sql`.
     */
    it('records no category for a tak, which the reports decide themselves', async () => {
        const columns = Object.keys((await statisticsRows('default_age_groups', ageGroup.id))[0]);

        expect(columns).not.toContain('category');
    });

    /**
     * A tak with several names has them joined by the structure with a translated separator. This
     * service loads no locales, so reading that getter writes the translation key into the database
     * instead of the word.
     */
    it('writes a tak with several names as words, not as a translation key', async () => {
        const platform = await Platform.getForEditing();
        const combined = DefaultAgeGroup.create({ names: ['Kapoenen', 'Welpen'], minAge: 6, maxAge: 10 });
        platform.config.defaultAgeGroups = [...platform.config.defaultAgeGroups, combined];
        await platform.save();
        await Platform.clearCache();

        await syncStatistics();

        const rows = await statisticsRows('default_age_groups', combined.id);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            expect(row.name).toBe('Kapoenen of Welpen');
        }
    });

    /**
     * The platform configuration holds one name per tak, netwerk, lidgeldtype and functie and no
     * history at all, so the name it carries now is written against each year still open.
     */
    it('writes the platform configuration against every period that is still open', async () => {
        const now = new Date();
        const periods = await statisticsRows('registration_periods');
        const open = new Set(periods.filter(row => (row.cutoffAt === null || row.cutoffAt > now) && row.lockedAt === null).map(row => row.id));
        const written = new Set((await statisticsRows('default_age_groups', ageGroup.id)).map(row => row.periodId));

        expect(open.size).toBeGreaterThan(0);
        expect([...open].filter(periodId => !written.has(periodId))).toEqual([]);
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

        expect((await statisticsRows('members', member.id))[0].birthDate).toEqual(new Date(Date.UTC(2009, 2, 3)));
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
        await new RegistrationFactory({ member: orphan, group: await new GroupFactory({ organization }).create() }).create();
        await syncStatistics();
        await orphan.delete();

        await syncStatisticsDeletes();

        expect(await statisticsRows('members', orphan.id)).toHaveLength(1);
    });

    /**
     * Organizations, groups and registrations all point at a period with ON DELETE RESTRICT, so
     * removing one is either refused outright or takes a settled year's numbers with it.
     */
    it('keeps a period whose source row is gone, since every figure hangs off it', async () => {
        const orphan = await new RegistrationPeriodFactory({}).create();
        await syncStatistics();
        await orphan.delete();

        await syncStatisticsDeletes();

        expect(await statisticsRows('registration_periods', orphan.id)).toHaveLength(1);
    });

    describe('a frozen period', () => {
        let frozenPeriod: RegistrationPeriod;
        let frozenRegistration: Registration;
        let settledMember: Member;

        beforeAll(async () => {
            frozenPeriod = await new RegistrationPeriodFactory({}).create();
            const group = await new GroupFactory({ organization }).create();
            group.periodId = frozenPeriod.id;
            await group.save();
            frozenRegistration = await new RegistrationFactory({ member, group }).create();
            frozenRegistration.periodId = frozenPeriod.id;
            await frozenRegistration.save();

            // Someone registered in both the year about to settle and the one still running.
            settledMember = await new MemberFactory({ organization }).create();
            settledMember.details.gender = Gender.Female;
            await settledMember.save();
            await new RegistrationFactory({ member: settledMember, group }).create();
            await new RegistrationFactory({ member: settledMember, group: await new GroupFactory({ organization }).create() }).create();

            await syncStatistics();
            // Settle the period, as an operator would once its numbers are final.
            await getStatisticsConnection().update('UPDATE `registration_periods` SET `cutoffAt` = ? WHERE `id` = ?', [new Date(Date.now() - 1000), frozenPeriod.id]);
        });

        /**
         * The whole reason a member is recorded per period: their details are what they are now, and
         * a settled year has to keep the ones it was counted with.
         */
        it('keeps the member as they were counted, while the year still running follows the source', async () => {
            const genderPerPeriod = async () => Object.fromEntries((await statisticsRows('members', settledMember.id)).map(row => [row.periodId, row.gender]));
            const before = await genderPerPeriod();

            settledMember.details.gender = Gender.Male;
            await settledMember.save();
            await syncStatistics();

            const after = await genderPerPeriod();
            expect(before[frozenPeriod.id]).toBe(Gender.Female);
            expect(after[frozenPeriod.id]).toBe(Gender.Female);
            expect(after[organization.periodId]).toBe(Gender.Male);
        });

        /**
         * The same rule as for the member, applied to the two things the source keeps no history for
         * at all: a unit's own name, and a tak's name from the platform configuration.
         */
        it('keeps the unit and the tak named as they were counted, while the year still running follows the source', async () => {
            const nameOf = async (table: string, id: string) =>
                Object.fromEntries((await statisticsRows(table, id)).map(row => [row.periodId, row.name]));

            const ageGroupId = ageGroup.id;
            const before = { unit: await nameOf('organizations', organization.id), tak: await nameOf('default_age_groups', ageGroupId) };

            organization.name = 'Hernoemde eenheid';
            await organization.save();

            const platform = await Platform.getForEditing();
            platform.config.defaultAgeGroups.find(group => group.id === ageGroupId)!.names = ['Hernoemde tak'];
            await platform.save();
            await Platform.clearCache();

            await syncStatistics();

            const after = { unit: await nameOf('organizations', organization.id), tak: await nameOf('default_age_groups', ageGroupId) };
            expect(after.unit[frozenPeriod.id]).toBe(before.unit[frozenPeriod.id]);
            expect(after.tak[frozenPeriod.id]).toBe(before.tak[frozenPeriod.id]);
            expect(after.unit[organization.periodId]).toBe('Hernoemde eenheid');
            expect(after.tak[organization.periodId]).toBe('Hernoemde tak');
        });

        it('is not rewritten by the sync when the source changes', async () => {
            frozenRegistration.deactivatedAt = new Date(2025, 0, 15);
            await frozenRegistration.save();
            await syncStatistics();

            expect((await statisticsRows('registrations', frozenRegistration.id))[0].deactivatedAt).toBeNull();
        });

        it('keeps its rows when the source is deleted, so the settled numbers stay', async () => {
            await frozenRegistration.delete();

            await syncStatistics();
            await syncStatisticsDeletes();

            expect(await statisticsRows('registrations', frozenRegistration.id)).toHaveLength(1);
        });
    });

    /**
     * Locking a period in the administration says its year is done. The sync keeps writing it for one
     * more run -- the changes and the deletions of the day it was locked have to land somewhere -- and
     * leaves it alone from the run after that.
     */
    describe('a period the administration locked', () => {
        const day = 24 * 60 * 60 * 1000;

        async function periodRow(period: RegistrationPeriod): Promise<Record<string, any>> {
            return (await statisticsRows('registration_periods', period.id))[0];
        }

        /**
         * A year with a registration in it, synced and then locked: the state the sync finds on the
         * night it first sees the lock. Ends in a month unless told otherwise, so unlocking it again
         * falls inside the window that reopens a period.
         */
        async function lockedYear(endDate = new Date(Date.now() + 30 * day)): Promise<{ period: RegistrationPeriod; registration: Registration }> {
            const period = await new RegistrationPeriodFactory({ startDate: new Date(endDate.getTime() - 365 * day), endDate }).create();
            const group = await new GroupFactory({ organization }).create();
            group.periodId = period.id;
            await group.save();
            const registration = await new RegistrationFactory({ member, group }).create();
            registration.periodId = period.id;
            await registration.save();

            await runStatisticsCycle();

            period.locked = true;
            await period.save();

            return { period, registration };
        }

        async function deactivate(registration: Registration, at: Date | null): Promise<void> {
            registration.deactivatedAt = at;
            await registration.save();
        }

        async function deactivatedAt(registration: Registration): Promise<Date | null> {
            return (await statisticsRows('registrations', registration.id))[0].deactivatedAt;
        }

        it('still writes what changed on the day it was locked', async () => {
            const { period, registration } = await lockedYear();
            const changed = new Date(2025, 5, 1);

            await deactivate(registration, changed);
            await runStatisticsCycle();

            expect(await deactivatedAt(registration)).toEqual(changed);
            expect((await periodRow(period)).lockedAt).toBeInstanceOf(Date);
        });

        /**
         * Deletes are noticed by the reconciliation and nothing else, so a registration removed on the
         * day of the lock is only taken out if that pass runs before the period is settled.
         */
        it('still removes what was deleted on the day it was locked', async () => {
            const { registration } = await lockedYear();
            const deletedId = registration.id;

            await registration.delete();
            await runStatisticsCycle();

            expect(await statisticsRows('registrations', deletedId)).toHaveLength(0);
        });

        it('is left alone from the run after that', async () => {
            const { registration } = await lockedYear();
            await runStatisticsCycle();

            await deactivate(registration, new Date(2025, 5, 2));
            await runStatisticsCycle();

            expect(await deactivatedAt(registration)).toBeNull();
        });

        /**
         * A run that threw never settles the period, so the night it was locked is repeated until one
         * comes through in full rather than skipped.
         */
        it('is written again by the next run when a run did not come through', async () => {
            const { period, registration } = await lockedYear();
            const changed = new Date(2025, 5, 3);

            // The incremental pass came through and the reconciliation after it threw.
            await syncStatistics();
            expect((await periodRow(period)).lockedAt).toBeNull();

            await deactivate(registration, changed);
            await runStatisticsCycle();

            expect(await deactivatedAt(registration)).toEqual(changed);
            expect((await periodRow(period)).lockedAt).toBeInstanceOf(Date);
        });

        it('is followed again from the same run it is unlocked in', async () => {
            const { period, registration } = await lockedYear();
            await runStatisticsCycle();
            const changed = new Date(2025, 5, 4);

            period.locked = false;
            await period.save();
            await deactivate(registration, changed);
            await runStatisticsCycle();

            expect(await deactivatedAt(registration)).toEqual(changed);
            expect((await periodRow(period)).lockedAt).toBeNull();
            expect((await periodRow(period)).locked).toBe(0);
        });

        /**
         * Unlocking a year that is long over is not a correction to make in the reports: what its rows
         * would be written from is the administration of today, which no longer describes that year.
         */
        it('stays settled when a year that ended long ago is unlocked', async () => {
            const { period, registration } = await lockedYear(new Date(Date.now() - 2 * 365 * day));
            await runStatisticsCycle();

            period.locked = false;
            await period.save();
            await deactivate(registration, new Date(2025, 5, 5));
            await runStatisticsCycle();

            expect(await deactivatedAt(registration)).toBeNull();
            expect((await periodRow(period)).lockedAt).toBeInstanceOf(Date);
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

    /**
     * Which tarief a lidgeld was charged at is what the reports split the lidgelden by, and nothing in
     * the administration records it per lidgeld: the price is worked out from whether the member has
     * financiële ondersteuning or an active UITPAS, and only the amount is kept. The sync reads that
     * same status off the member, so a lidgeld carries the tarief it was made at.
     */
    describe('the tarief of a lidgeld', () => {
        async function membershipOf(member: Member, type: PlatformMembershipType): Promise<MemberPlatformMembership> {
            const membership = new MemberPlatformMembership();
            membership.memberId = member.id;
            membership.membershipTypeId = type.id;
            membership.organizationId = organization.id;
            membership.periodId = period.id;
            membership.startDate = period.startDate;
            membership.endDate = period.endDate;
            await membership.save();
            return membership;
        }

        it('marks the lidgeld of a member with financiële ondersteuning as the verlaagd tarief', async () => {
            const type = PlatformMembershipType.create({ name: 'Volledig scoutsjaar' });
            const platform = await Platform.getForEditing();
            platform.config.membershipTypes = [type];
            platform.config.financialSupport = FinancialSupportSettings.create({ priceName: 'SOMkort' });
            await platform.save();
            await Platform.clearCache();

            const supported = await new MemberFactory({ organization }).create();
            supported.details.requiresFinancialSupport = BooleanStatus.create({ value: true });
            await supported.save();

            const standard = await membershipOf(member, type);
            const reduced = await membershipOf(supported, type);

            await syncStatistics();

            expect((await statisticsRows('member_platform_memberships', standard.id))[0].reducedPrice).toBe(0);
            expect((await statisticsRows('member_platform_memberships', reduced.id))[0].reducedPrice).toBe(1);
        });

        /**
         * The name of that tarief is the koepel's own -- SOMkort, kansentarief -- so the reports print
         * what the platform calls it instead of a wording of their own.
         */
        it('writes what the platform calls its verlaagd tarief', async () => {
            const platform = await Platform.getForEditing();
            platform.config.financialSupport = FinancialSupportSettings.create({ priceName: 'SOMkort' });
            await platform.save();
            await Platform.clearCache();

            await syncStatistics();

            expect((await statisticsRows('platform', platform.id))[0].reducedPriceName).toBe('SOMkort');
        });
    });

    it('never deletes rows that came from an import, which have no source row to check against', async () => {
        const connection = getStatisticsConnection();
        // The statistics database is kept between runs, so start from a known state.
        await connection.delete('DELETE FROM `members` WHERE `id` = ?', ['imported-member-1']);
        await connection.insert(
            'INSERT INTO `members` (`id`, `periodId`, `birthDate`, `gender`, `createdAt`, `updatedAt`, `source`) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['imported-member-1', period.id, new Date(Date.UTC(2004, 0, 15)), 'Female', new Date(), new Date(), 'import'],
        );

        await syncStatisticsDeletes();

        expect(await statisticsRows('members', 'imported-member-1')).toHaveLength(1);
    });
});
