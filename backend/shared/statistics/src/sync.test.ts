import type { Member, Organization, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, RegistrationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
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
        expect(Object.keys(row).sort()).toEqual(['birthYear', 'createdAt', 'gender', 'id', 'lastRegisteredAt', 'organizationId', 'updatedAt']);
        expect(JSON.stringify(row)).not.toContain(member.details.firstName);
    });

    it('copies the registration, so a member can hold several', async () => {
        const [row] = await statisticsRows('registrations', registration.id);

        expect(row).toBeDefined();
        expect(row.memberId).toBe(member.id);
        expect(row.groupId).toBe(registration.groupId);
    });

    it('copies the organization with only its city', async () => {
        const [row] = await statisticsRows('organizations', organization.id);

        expect(row).toBeDefined();
        expect(row.name).toBe(organization.name);
        expect(row.city).toBe(organization.address.city);
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

    it('removes a row whose source was deleted, but only once deletes are reconciled', async () => {
        const deletedId = registration.id;
        await registration.delete();

        // An incremental pass has nothing to notice: the row is simply gone from the source.
        await syncStatistics();
        expect(await statisticsRows('registrations', deletedId)).toHaveLength(1);

        await syncStatisticsDeletes();

        expect(await statisticsRows('registrations', deletedId)).toHaveLength(0);
        // The member it belonged to is untouched.
        expect(await statisticsRows('members', member.id)).toHaveLength(1);
    });
});
