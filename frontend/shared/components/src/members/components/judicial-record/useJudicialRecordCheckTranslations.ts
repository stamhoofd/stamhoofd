import { JudicialRecordCheck, JudicialRecordCheckStatus } from '@stamhoofd/structures';

/**
 * Who is looking at the checklist. It changes only the message under the list - never which rows
 * are on it, nor what they say: those say what the backend said they say. A reviewer is told what
 * to do with the document; the member is told what happens next.
 */
export type JudicialRecordCheckAudience = 'member' | 'reviewer';

export function useJudicialRecordCheckTranslations(): {
    getTitle: (check: JudicialRecordCheck) => string;
    getIcon: (check: JudicialRecordCheck) => string;
} {
    const titles: Record<JudicialRecordCheck, string> = {
        [JudicialRecordCheck.Authentic]: $t('Echt attest van FOD Justitie'),
        [JudicialRecordCheck.Model]: $t('Model 596.2'),
        [JudicialRecordCheck.Identity]: $t('Naam en geboortedatum'),
        [JudicialRecordCheck.Age]: $t('Recent genoeg'),
        [JudicialRecordCheck.EmptyRecord]: $t('Blanco strafregister'),
    };

    const icons: Record<JudicialRecordCheck, string> = {
        [JudicialRecordCheck.Authentic]: 'privacy',
        [JudicialRecordCheck.Model]: 'file',
        [JudicialRecordCheck.Identity]: 'user',
        [JudicialRecordCheck.Age]: 'clock',
        [JudicialRecordCheck.EmptyRecord]: 'check-list',
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
