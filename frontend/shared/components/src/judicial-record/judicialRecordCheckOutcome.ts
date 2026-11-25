import { JudicialRecordCheck, JudicialRecordCheckReport, judicialRecordChecksInOrder } from '@stamhoofd/structures';

/**
 * What the five results add up to. Derived here rather than sent along, because it is a reading of
 * the same results the rows already show: there is nothing in it the report does not say.
 */
export enum JudicialRecordCheckOutcome {
    /** Every check has a verdict and every verdict passed. */
    Passed = 'Passed',

    /** Everything we can check is in order, the record simply is not empty. A reviewer decides. */
    NotEmptyRecord = 'NotEmptyRecord',

    /** A check other than the empty record check refused the document. */
    Failed = 'Failed',

    /** At least one check has no verdict yet, so there is nothing to conclude. */
    Pending = 'Pending',
}

/**
 * A failure that is not about the content of the record outranks everything else: there is no point
 * telling someone their record is being reviewed when we could not read the document in the first
 * place. A missing verdict comes next, since a conclusion drawn from four of five checks is not a
 * conclusion.
 */
export function getJudicialRecordCheckOutcome(report: JudicialRecordCheckReport): JudicialRecordCheckOutcome {
    if (report.failedChecks.some(result => result.check !== JudicialRecordCheck.EmptyRecord)) {
        return JudicialRecordCheckOutcome.Failed;
    }

    if (!hasEveryVerdict(report)) {
        return JudicialRecordCheckOutcome.Pending;
    }

    if (report.get(JudicialRecordCheck.EmptyRecord)?.isFailed === true) {
        return JudicialRecordCheckOutcome.NotEmptyRecord;
    }

    return JudicialRecordCheckOutcome.Passed;
}

/** Every check answered, one way or the other. A check that never arrived has not answered either. */
function hasEveryVerdict(report: JudicialRecordCheckReport): boolean {
    return judicialRecordChecksInOrder.every((check) => {
        const result = report.get(check);
        return result !== null && (result.isPassed || result.isFailed);
    });
}
