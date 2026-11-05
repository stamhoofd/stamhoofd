import type { Organization } from '@stamhoofd/models';
import { MemberResponsibilityRecord, Platform } from '@stamhoofd/models';
import type { SQLExpression, SQLWhere } from '@stamhoofd/sql';
import { SQL, SQLCount, SQLDateAddYears, SQLNow, SQLNull, SQLScalar, SQLSubQuery, SQLWhereSign } from '@stamhoofd/sql';
import { JudicialRecordStatus } from '@stamhoofd/structures';

/**
 * Minimum age per responsibility, for the responsibilities that ask for a judicial record extract.
 *
 * Organizations can define their own responsibilities next to the platform ones, so the responsibilities of the
 * organization in scope are included when there is one.
 */
export async function getJudicialRecordMinimumAges(organization: Organization | null): Promise<Map<string, number>> {
    const platform = await Platform.getSharedStruct();

    const responsibilities = [
        ...platform.config.responsibilities,
        ...(organization?.privateMeta.responsibilities ?? []),
    ];

    const minimumAges = new Map<string, number>();

    for (const responsibility of responsibilities) {
        if (responsibility.judicialRecordMinimumAge !== null) {
            minimumAges.set(responsibility.id, responsibility.judicialRecordMinimumAge);
        }
    }

    return minimumAges;
}

/** The status of a member that matches none of the conditions below. */
const fallbackStatus = JudicialRecordStatus.NotRequired;

/** Marks the one status in the map that is the fallback, instead of a condition of its own. */
const otherwise = 'otherwise';

/**
 * At least one responsibility requires the member to have an extract checked today.
 *
 * The SQL mirror of `JudicialRecordHelper.requiresExtract` (`shared/structures/src/helpers/`), condition by
 * condition, as an EXISTS over the member's responsibility records. Keep the two in the same order, and keep
 * `backend/app/api/tests/filters/judicial-record.test.ts` green: it runs both over the same members.
 */
function requiresExtract(minimumAges: Map<string, number>): SQLWhere {
    const startDate = SQL.column(MemberResponsibilityRecord.table, 'startDate');
    const endDate = SQL.column(MemberResponsibilityRecord.table, 'endDate');
    const birthDay = SQL.column('members', 'birthDay');

    // The minimum age of the responsibility this record points to
    let minimumAge: SQLExpression = new SQLNull();
    for (const [responsibilityId, age] of minimumAges) {
        minimumAge = SQL.if(SQL.column(MemberResponsibilityRecord.table, 'responsibilityId'), responsibilityId)
            .then(age)
            .else(minimumAge);
    }

    const records = new SQLSubQuery(
        SQL.select(new SQLCount())
            .from(SQL.table(MemberResponsibilityRecord.table))
            .where(SQL.column(MemberResponsibilityRecord.table, 'memberId'), SQL.column('members', 'id'))
            // 1. the responsibility asks for an extract
            .where(SQL.column(MemberResponsibilityRecord.table, 'responsibilityId'), [...minimumAges.keys()])
            // 2. the member holds it today
            .where(startDate, SQLWhereSign.LessEqual, new SQLNow())
            .where(SQL.where(endDate, null).or(endDate, SQLWhereSign.Greater, new SQLNow()))
            // 3. and has reached its minimum age (no birth day means adult)
            .where(SQL.where(birthDay, null).or(new SQLDateAddYears(birthDay, minimumAge), SQLWhereSign.LessEqual, new SQLNow())),
    );

    return SQL.where(records, SQLWhereSign.Greater, 0);
}

/**
 * The judicial record status of a member today, as one of the `JudicialRecordStatus` values.
 *
 * The status is derived instead of stored, so it stays correct when the age of a responsibility changes or when a
 * member gains or loses a responsibility.
 */
export function judicialRecordStatusExpression(minimumAges: Map<string, number>): SQLExpression {
    if (minimumAges.size === 0) {
        // No responsibility asks for an extract, so no condition can match
        return new SQLScalar(fallbackStatus);
    }

    // One entry per status: a new JudicialRecordStatus does not compile until SQL decides it too. The first
    // matching condition wins; the status marked `otherwise` is the one left over.
    const conditions: Record<JudicialRecordStatus, SQLWhere | typeof otherwise> = {
        [JudicialRecordStatus.Required]: requiresExtract(minimumAges),
        [JudicialRecordStatus.NotRequired]: otherwise,
    };

    let expression: SQLExpression | null = null;

    // Reverse order: the last condition is the innermost else of the IF chain, so the first one wins
    for (const status of Object.keys(conditions).reverse() as JudicialRecordStatus[]) {
        const condition = conditions[status];

        if (condition === otherwise) {
            if (expression !== null) {
                throw new Error('Only the last judicial record status can be the fallback');
            }
            expression = new SQLScalar(status);
            continue;
        }

        if (expression === null) {
            throw new Error('The last judicial record status has to be the fallback');
        }

        expression = SQL.if(condition).then(status).else(expression);
    }

    if (expression === null) {
        throw new Error('No judicial record statuses defined');
    }

    return expression;
}
