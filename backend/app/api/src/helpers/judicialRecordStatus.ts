import type { Organization } from '@stamhoofd/models';
import { JudicialRecord, MemberResponsibilityRecord, Platform } from '@stamhoofd/models';
import type { SQLExpression, SQLWhere } from '@stamhoofd/sql';
import { SQL, SQLCount, SQLDateAddYears, SQLNow, SQLNull, SQLScalar, SQLSubQuery, SQLWhereSign } from '@stamhoofd/sql';
import { JUDICIAL_RECORD_VALIDITY_YEARS, JudicialRecordReviewStatus, JudicialRecordStatus } from '@stamhoofd/structures';

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
 * Whether the member's current judicial record matches `condition`.
 *
 * `currentMemberId` is NULL on superseded rows, so the row that counts is found by an indexed equality rather
 * than a max(createdAt) subquery per member. A record whose identity hash no longer matches the member is not
 * found at all: it was granted to a different name or birth date, so it says nothing about who they are now.
 *
 * Everything about the record is asked inside this subquery, because `judicial_records` is not joined into the
 * query this expression ends up in - the outer query is over `members`.
 */
function currentRecordMatches(condition: SQLWhere): SQLWhere {
    const records = new SQLSubQuery(
        SQL.select(new SQLCount())
            .from(SQL.table(JudicialRecord.table))
            .where(SQL.column(JudicialRecord.table, 'currentMemberId'), SQL.column('members', 'id'))
            .where(SQL.column(JudicialRecord.table, 'identityHash'), SQL.column('members', 'judicialIdentityHash'))
            .where(condition),
    );

    return SQL.where(records, SQLWhereSign.Greater, 0);
}

/** The review outcomes a record may carry. */
function reviewStatusIs(...statuses: JudicialRecordReviewStatus[]): SQLWhere {
    return SQL.where(SQL.column(JudicialRecord.table, 'reviewStatus'), statuses);
}

/**
 * A decision this old no longer stands, so the member is back to having to deliver one.
 *
 * The mirror of `JudicialRecordHelper.hasExpired`. Validity runs from the review and not from the document,
 * because the document is deleted as soon as a decision is made and nothing can be recomputed from it.
 */
function decisionStillStands(): SQLWhere {
    const reviewedAt = SQL.column(JudicialRecord.table, 'reviewedAt');

    return SQL.where(reviewedAt, null)
        .or(new SQLDateAddYears(reviewedAt, new SQLScalar(JUDICIAL_RECORD_VALIDITY_YEARS)), SQLWhereSign.Greater, new SQLNow());
}

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

    // A delivered outcome only says anything while an extract is actually required, so every stored condition
    // is ANDed with the requirement: a member who no longer holds a responsibility that asks for one is
    // NotRequired, whatever they delivered before. Mirrors what JudicialRecordHelper.getStatus does.
    const required = requiresExtract(minimumAges);

    // One entry per status: a new JudicialRecordStatus does not compile until SQL decides it too. The first
    // matching condition wins; the status marked `otherwise` is the one left over.
    const conditions: Record<JudicialRecordStatus, SQLWhere | typeof otherwise> = {
        [JudicialRecordStatus.UnderReview]: currentRecordMatches(
            reviewStatusIs(JudicialRecordReviewStatus.UnderReview),
        ).and(required),

        // A permanent rejection expires like an approval does; a temporary one already asks the member to
        // deliver again, so there is nothing for an expiry to change.
        [JudicialRecordStatus.Rejected]: currentRecordMatches(
            reviewStatusIs(JudicialRecordReviewStatus.TemporarilyRejected)
                .or(reviewStatusIs(JudicialRecordReviewStatus.PermanentlyRejected).and(decisionStillStands())),
        ).and(required),

        [JudicialRecordStatus.Ok]: currentRecordMatches(
            reviewStatusIs(JudicialRecordReviewStatus.Ok, JudicialRecordReviewStatus.ConditionallyAccepted)
                .and(decisionStillStands()),
        ).and(required),

        [JudicialRecordStatus.Required]: required,
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
