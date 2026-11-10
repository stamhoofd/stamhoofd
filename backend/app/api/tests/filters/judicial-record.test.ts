import type { Organization } from '@stamhoofd/models';
import { JudicialRecord, Member, MemberFactory, MemberResponsibilityRecordFactory, OrganizationFactory, Platform, PlatformResponsibilityFactory } from '@stamhoofd/models';
import { SQL, SQLAlias, SQLSelectAs, compileToSQLFilter } from '@stamhoofd/sql';
import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilterTypes';
import type { JudicialRecordCurrentRecord, JudicialRecordResponsibility, MemberResponsibility } from '@stamhoofd/structures';
import { JUDICIAL_RECORD_VALIDITY_YEARS, JudicialRecordHelper, JudicialRecordReviewStatus, JudicialRecordStatus } from '@stamhoofd/structures';

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

        /** A delivered extract, when the scenario has one. */
        record?: {
            reviewStatus: JudicialRecordReviewStatus;

            /** Null leaves it unreviewed, which is what UnderReview means. */
            reviewedAt?: Date | null;

            /** Snapshots a different identity, as a rename or a corrected birth date does. */
            identityChanged?: boolean;

            /** An older, superseded row to prove only the current one is read. */
            supersededStatus?: JudicialRecordReviewStatus;
        };
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

            // Delivered extracts. The same adult who would otherwise be Required, so the record is the only
            // thing that moves the status.
            ...storedScenarios(),
        ];
    }

    /**
     * The adult of the first scenario, who is Required until a record says otherwise.
     *
     * A function and not a constant: the responsibilities only exist after beforeAll, the same reason
     * buildScenarios is lazy.
     */
    function requiredAdult() {
        return {
            birthDay: { year: 1990, month: 3, day: 10 },
            responsibilities: [{ responsibility: withAge, startDate: longAgo }],
        };
    }

    function yearsAgo(years: number, plusDays = 0): Date {
        const date = new Date();
        date.setFullYear(date.getFullYear() - years);
        date.setDate(date.getDate() + plusDays);
        return date;
    }

    /** One scenario per path through the stored half of the rule, including every review outcome. */
    function storedScenarios(): Scenario[] {
        const justReviewed = daysFromNow(-1);
        const expired = yearsAgo(JUDICIAL_RECORD_VALIDITY_YEARS, -1);
        const almostExpired = yearsAgo(JUDICIAL_RECORD_VALIDITY_YEARS, 1);

        return [
            {
                name: 'delivered, nobody has looked yet',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.UnderReview, reviewedAt: null },
            },
            {
                name: 'approved yesterday',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.Ok, reviewedAt: justReviewed },
            },
            {
                name: 'accepted under conditions',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.ConditionallyAccepted, reviewedAt: justReviewed },
            },
            {
                name: 'approved just inside the validity window',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.Ok, reviewedAt: almostExpired },
            },
            {
                name: 'approved just outside the validity window',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.Ok, reviewedAt: expired },
            },
            {
                name: 'temporarily rejected',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.TemporarilyRejected, reviewedAt: justReviewed },
            },
            {
                name: 'permanently rejected',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.PermanentlyRejected, reviewedAt: justReviewed },
            },
            {
                name: 'permanently rejected long enough ago to have lapsed',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.PermanentlyRejected, reviewedAt: expired },
            },
            {
                name: 'approved, but the member has been renamed since',
                ...requiredAdult(),
                record: { reviewStatus: JudicialRecordReviewStatus.Ok, reviewedAt: justReviewed, identityChanged: true },
            },
            {
                name: 'approved now, rejected on an older superseded delivery',
                ...requiredAdult(),
                record: {
                    reviewStatus: JudicialRecordReviewStatus.Ok,
                    reviewedAt: justReviewed,
                    supersededStatus: JudicialRecordReviewStatus.PermanentlyRejected,
                },
            },
            {
                name: 'approved, but no responsibility asks for an extract any more',
                birthDay: { year: 1990, month: 3, day: 10 },
                responsibilities: [{ responsibility: withAge, startDate: longAgo, endDate: daysFromNow(-1) }],
                record: { reviewStatus: JudicialRecordReviewStatus.Ok, reviewedAt: daysFromNow(-1) },
            },
        ];
    }

    /** The identity hash the database generated for this member, which a record snapshots verbatim. */
    async function selectIdentityHash(memberId: string): Promise<string> {
        const rows = await SQL.select(SQL.column('members', 'judicialIdentityHash'))
            .from(SQL.table(Member.table))
            .where(SQL.column('members', 'id'), memberId)
            .fetch();

        return rows[0]['members']['judicialIdentityHash'] as string;
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

        let record: JudicialRecordCurrentRecord | null = null;

        if (scenario.record) {
            const identityHash = await selectIdentityHash(member.id);

            // A changed identity is a snapshot of a hash that is not the member's any more. Written as a
            // different hash rather than by renaming the member, so the scenario stays a property of the row.
            const snapshot = scenario.record.identityChanged
                ? identityHash.replace(/^./, character => (character === 'a' ? 'b' : 'a'))
                : identityHash;

            if (scenario.record.supersededStatus) {
                const older = new JudicialRecord();
                older.memberId = member.id;
                older.reviewStatus = scenario.record.supersededStatus;
                older.reviewedAt = daysFromNow(-2);
                older.identityHash = snapshot;
                older.supersededAt = daysFromNow(-1);
                await older.save();
            }

            const current = new JudicialRecord();
            current.memberId = member.id;
            current.reviewStatus = scenario.record.reviewStatus;
            current.reviewedAt = scenario.record.reviewedAt ?? null;
            current.identityHash = snapshot;
            await current.save();

            record = {
                reviewStatus: scenario.record.reviewStatus,
                identityMatches: !scenario.record.identityChanged,
                reviewedAt: scenario.record.reviewedAt ?? null,
            };
        }

        return {
            scenario,
            id: member.id,
            // The same inputs PlatformMember passes to the helper in the frontend
            helperStatus: JudicialRecordHelper.getStatus({
                firstName: member.details.firstName,
                birthDay: member.details.birthDay,
                responsibilities,
                record,
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

        // Every status has to be reached by some member, otherwise agreeing would prove nothing about it
        expect(new Set(members.map(m => m.helperStatus))).toEqual(new Set(Object.values(JudicialRecordStatus)));
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
