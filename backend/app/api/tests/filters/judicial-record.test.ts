import type { Organization } from '@stamhoofd/models';
import { Member, MemberFactory, MemberResponsibilityRecordFactory, OrganizationFactory, Platform, PlatformResponsibilityFactory } from '@stamhoofd/models';
import { SQL, SQLAlias, SQLSelectAs, compileToSQLFilter } from '@stamhoofd/sql';
import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilterTypes';
import type { JudicialRecordResponsibility, MemberResponsibility } from '@stamhoofd/structures';
import { JudicialRecordHelper, JudicialRecordStatus } from '@stamhoofd/structures';

import { judicialRecordStatusExpression } from '../../src/helpers/judicialRecordStatus.js';
import { memberFilterCompilers } from '../../src/sql-filters/members.js';

/**
 * These tests pin `judicialRecordStatusExpression()` (the SQL the member list filters and sorts on) to
 * `JudicialRecordHelper.requiresExtract` (the rule the frontend shows in the member view). Both decide the same
 * question: does this member have to have a judicial record extract checked today?
 *
 * Every scenario below runs through both engines over the same members and both have to agree, so the two
 * implementations cannot drift apart without a test failing.
 */
describe('Judicial record status (structures helper vs backend SQL parity)', () => {
    let organization: Organization;

    /** Asks for an extract from 20, the age the scenarios move around */
    let withAge: MemberResponsibility;

    /** Never asks for an extract */
    let withoutAge: MemberResponsibility;

    let originalResponsibilities: MemberResponsibility[];
    let minimumAges: Map<string, number>;

    const longAgo = new Date(2020, 0, 1);

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();

        const platform = await Platform.getForEditing();
        originalResponsibilities = platform.config.responsibilities;

        withAge = await new PlatformResponsibilityFactory({ name: 'Judicial record needed', judicialRecordMinimumAge: 20 }).create();
        withoutAge = await new PlatformResponsibilityFactory({ name: 'No judicial record needed' }).create();

        minimumAges = new Map([[withAge.id, 20]]);
    });

    afterAll(async () => {
        const platform = await Platform.getForEditing();
        platform.config.responsibilities = originalResponsibilities;
        await platform.save();
    });

    /** The birth day of a member that turns `age` in `inDays` days (negative = turned it that many days ago). */
    function birthDayOfSomeoneTurning(age: number, inDays: number): { year: number; month: number; day: number } {
        const date = new Date();
        date.setDate(date.getDate() + inDays);

        return { year: date.getFullYear() - age, month: date.getMonth() + 1, day: date.getDate() };
    }

    function daysFromNow(days: number): Date {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
    }

    type Scenario = {
        name: string;
        birthDay: { year: number; month: number; day: number } | null;
        responsibilities: { responsibility: MemberResponsibility; startDate?: Date; endDate?: Date | null }[];
    };

    /**
     * One member per scenario, each covering a condition of the rule or a boundary of it. No expected status is
     * written down: the point is that the helper and the SQL agree on all of them, whatever they decide.
     *
     * Built lazily, because the responsibilities only exist after beforeAll.
     */
    function buildScenarios(): Scenario[] {
        return [
            {
                name: 'adult who has held the responsibility for years',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [{ responsibility: withAge, startDate: longAgo }],
            },
            {
                name: 'child who is far from the minimum age',
                birthDay: { year: 2015, month: 6, day: 15 },
                responsibilities: [{ responsibility: withAge, startDate: longAgo }],
            },
            {
                name: 'turns 20 today',
                birthDay: birthDayOfSomeoneTurning(20, 0),
                responsibilities: [{ responsibility: withAge, startDate: longAgo }],
            },
            {
                name: 'turns 20 tomorrow',
                birthDay: birthDayOfSomeoneTurning(20, 1),
                responsibilities: [{ responsibility: withAge, startDate: longAgo }],
            },
            {
                name: 'turned 20 yesterday',
                birthDay: birthDayOfSomeoneTurning(20, -1),
                responsibilities: [{ responsibility: withAge, startDate: longAgo }],
            },
            {
                name: 'without a birth day, treated as an adult',
                birthDay: null,
                responsibilities: [{ responsibility: withAge, startDate: longAgo }],
            },
            {
                name: 'responsibility that never asks for an extract',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [{ responsibility: withoutAge, startDate: longAgo }],
            },
            {
                name: 'no responsibility at all',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [],
            },
            {
                name: 'responsibility that ended yesterday',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [{ responsibility: withAge, startDate: longAgo, endDate: daysFromNow(-1) }],
            },
            {
                name: 'responsibility that ends tomorrow',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [{ responsibility: withAge, startDate: longAgo, endDate: daysFromNow(1) }],
            },
            {
                name: 'responsibility that only starts tomorrow',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [{ responsibility: withAge, startDate: daysFromNow(1) }],
            },
            {
                name: 'responsibility that started today',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [{ responsibility: withAge, startDate: daysFromNow(0) }],
            },
            {
                name: 'one responsibility that asks and one that does not',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [
                    { responsibility: withoutAge, startDate: longAgo },
                    { responsibility: withAge, startDate: longAgo },
                ],
            },
            {
                name: 'too young for the one they hold, old enough for the one that ended',
                birthDay: birthDayOfSomeoneTurning(20, 10),
                responsibilities: [
                    { responsibility: withAge, startDate: longAgo },
                    { responsibility: withAge, startDate: longAgo, endDate: daysFromNow(-1) },
                ],
            },
        ];
    }

    /** Creates the member of a scenario and returns what both engines need to judge it */
    async function createScenarioMember(scenario: Scenario) {
        const member = scenario.birthDay
            ? await new MemberFactory({ organization, firstName: scenario.name, birthDay: scenario.birthDay }).create()
            : await new MemberFactory({ organization, firstName: scenario.name, generateData: false }).create();

        const responsibilities: JudicialRecordResponsibility[] = [];

        for (const record of scenario.responsibilities) {
            const created = await new MemberResponsibilityRecordFactory({
                member,
                organizationId: organization.id,
                responsibility: record.responsibility,
                startDate: record.startDate,
                endDate: record.endDate ?? null,
            }).create();

            responsibilities.push({
                startDate: created.startDate,
                endDate: created.endDate,
                minimumAge: record.responsibility.judicialRecordMinimumAge,
            });
        }

        return {
            scenario,
            id: member.id,
            // The same inputs PlatformMember passes to the helper in the frontend
            helperStatus: JudicialRecordHelper.getRequirement({
                birthDay: member.details.birthDay,
                responsibilities,
            }).status,
        };
    }

    /** The status the database derives for every member, by the expression the sorter and the filter use */
    async function selectSQLStatuses(): Promise<Map<string, string>> {
        const rows = await SQL
            .select(
                SQL.column('members', 'id'),
                new SQLSelectAs(judicialRecordStatusExpression(minimumAges), new SQLAlias('data__status')),
            )
            .from(SQL.table(Member.table))
            .fetch();

        const statuses = new Map<string, string>();

        for (const row of rows) {
            statuses.set(row['members']['id'] as string, row['data']['status'] as string);
        }

        return statuses;
    }

    /** The member ids the SQL filter returns, the same way GetMembersEndpoint compiles it */
    async function runSQLFilter(filter: StamhoofdFilter): Promise<string[]> {
        const rows = await SQL
            .select(SQL.column('members', 'id'))
            .from(SQL.table(Member.table))
            .where(await compileToSQLFilter(filter, memberFilterCompilers(organization.id, { judicialRecordMinimumAges: minimumAges })))
            .fetch();

        return rows.map(row => row['members']['id'] as string).sort();
    }

    test('the helper and the SQL expression agree on every member', async () => {
        const members: { scenario: Scenario; id: string; helperStatus: JudicialRecordStatus }[] = [];

        for (const scenario of buildScenarios()) {
            members.push(await createScenarioMember(scenario));
        }

        const sqlStatuses = await selectSQLStatuses();

        for (const member of members) {
            expect(sqlStatuses.get(member.id), `SQL and helper disagree about "${member.scenario.name}"`).toBe(member.helperStatus);
        }

        // Both engines decide more than one status here, otherwise agreeing would prove nothing
        expect(new Set(members.map(m => m.helperStatus))).toEqual(new Set([JudicialRecordStatus.Required, JudicialRecordStatus.NotRequired]));
    });

    test('filtering on a status returns exactly the members the helper puts in it', async () => {
        const members: { scenario: Scenario; id: string; helperStatus: JudicialRecordStatus }[] = [];

        for (const scenario of buildScenarios()) {
            members.push(await createScenarioMember(scenario));
        }

        for (const status of Object.values(JudicialRecordStatus)) {
            const expected = members.filter(m => m.helperStatus === status).map(m => m.id).sort();
            const found = await runSQLFilter({ id: { $in: members.map(m => m.id) }, judicialRecordStatus: { $in: [status] } });

            expect(found, `the ${status} filter should return what the helper calls ${status}`).toEqual(expected);
        }
    });
});
