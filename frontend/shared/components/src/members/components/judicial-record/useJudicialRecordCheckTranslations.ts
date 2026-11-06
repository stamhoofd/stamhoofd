import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckStatus, judicialRecordChecksInOrder } from '@stamhoofd/structures';

/**
 * Who is looking at the checklist. It changes only the message under the list - never which rows
 * are on it, nor what they say: those say what the backend said they say. A reviewer is told what
 * to do with the document; the member is told what happens next.
 */
export type JudicialRecordCheckAudience = 'member' | 'reviewer';

/**
 * What the five results add up to. Derived here rather than sent along, because it is a reading of
 * the same results the rows already show: there is nothing in it the report does not say.
 */
export enum JudicialRecordCheckOutcome {
    /** Every check has a verdict and every verdict passed. */
    Passed = 'Passed',

    /** Everything we can check is in order, the record is simply not blank. A reviewer decides. */
    NotBlank = 'NotBlank',

    /** A check other than blank refused the document. */
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
    if (report.failedChecks.some(result => result.check !== JudicialRecordCheck.Blank)) {
        return JudicialRecordCheckOutcome.Failed;
    }

    if (!hasEveryVerdict(report)) {
        return JudicialRecordCheckOutcome.Pending;
    }

    if (report.get(JudicialRecordCheck.Blank)?.isFailed === true) {
        return JudicialRecordCheckOutcome.NotBlank;
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

export function useJudicialRecordCheckTranslations(): {
    getTitle: (check: JudicialRecordCheck) => string;
    getIcon: (check: JudicialRecordCheck) => string;
} {
    const titles: Record<JudicialRecordCheck, string> = {
        [JudicialRecordCheck.Authentic]: $t('Echt attest van FOD Justitie'),
        [JudicialRecordCheck.Identity]: $t('Naam en geboortedatum'),
        [JudicialRecordCheck.Model]: $t('Model 596.2'),
        [JudicialRecordCheck.Age]: $t('Recent genoeg'),
        [JudicialRecordCheck.Blank]: $t('Blanco'),
    };

    const icons: Record<JudicialRecordCheck, string> = {
        [JudicialRecordCheck.Authentic]: 'privacy',
        [JudicialRecordCheck.Identity]: 'user',
        [JudicialRecordCheck.Model]: 'file',
        [JudicialRecordCheck.Age]: 'clock',
        [JudicialRecordCheck.Blank]: 'check-list',
    };

    return {
        getTitle: (check: JudicialRecordCheck) => titles[check],
        getIcon: (check: JudicialRecordCheck) => icons[check],
    };
}

/** The colour of the tile behind a check's icon. */
export function getJudicialRecordCheckColor(status: JudicialRecordCheckStatus): string {
    switch (status) {
        case JudicialRecordCheckStatus.Passed: return 'success';
        case JudicialRecordCheckStatus.Failed: return 'error';

        // No verdict is not a verdict: grey, with the reason saying what it is waiting on.
        case JudicialRecordCheckStatus.Pending: return 'gray';
    }
}

/** The small badge in the corner of the tile. */
export function getJudicialRecordCheckBadge(status: JudicialRecordCheckStatus): string {
    switch (status) {
        case JudicialRecordCheckStatus.Passed: return 'success green';
        case JudicialRecordCheckStatus.Failed: return 'canceled red';
        case JudicialRecordCheckStatus.Pending: return 'dot gray';
    }
}
