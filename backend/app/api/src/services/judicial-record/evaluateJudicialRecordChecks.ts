import { JUDICIAL_RECORD_MAX_DOCUMENT_AGE_DAYS, JudicialRecordCheck, JudicialRecordCheckExplanation, JudicialRecordCheckResult, JudicialRecordCheckStatus, JudicialRecordHelper, JudicialRecordStatus } from '@stamhoofd/structures';
import type { ParsedJudicialRecordExtract } from './parseJudicialRecordExtract.js';

export interface JudicialRecordMemberIdentity {
    firstName: string;
    lastName: string;
    birthDay: Date | null;
}

export interface EvaluateJudicialRecordChecksOptions {
    parsed: ParsedJudicialRecordExtract;
    member: JudicialRecordMemberIdentity;
    /** So a document cannot age out of validity while it waits in the queue. */
    deliveredAt: Date;
    authentic: JudicialRecordCheckResult;
}

/** The five checks of the automatic control, in the order they are shown. */
export function evaluateJudicialRecordChecks({ parsed, member, deliveredAt, authentic }: EvaluateJudicialRecordChecksOptions): JudicialRecordCheckResult[] {
    return [
        authentic,
        checkIdentity(parsed, member),
        checkModel(parsed),
        checkAge(parsed, deliveredAt),
        checkBlank(parsed),
    ];
}

/**
 * The parse error is the explanation, so the member is told we could not read the document rather
 * than that the document is wrong - which for a French or German extract it is not.
 */
export function unreadableJudicialRecordChecks(code: string, authentic: JudicialRecordCheckResult): JudicialRecordCheckResult[] {
    return [
        authentic,
        ...CONTENT_CHECKS.map(check => result(check, JudicialRecordCheckStatus.Failed, JudicialRecordCheckExplanation.DocumentNotReadable, { code })),
    ];
}

const CONTENT_CHECKS = [JudicialRecordCheck.Identity, JudicialRecordCheck.Model, JudicialRecordCheck.Age, JudicialRecordCheck.Blank];

/** The signature did not hold, so the text was never read. */
export function notStartedJudicialRecordChecks(): JudicialRecordCheckResult[] {
    return CONTENT_CHECKS.map(check => result(check, JudicialRecordCheckStatus.NotStarted));
}

/**
 * Not blank is never by itself a reason for an automatic rejection: it goes straight to a reviewer.
 * So does a check that did not run, so nothing is approved on a check we did not perform.
 */
export function getJudicialRecordDeliveryStatus(checks: JudicialRecordCheckResult[]): JudicialRecordStatus {
    if (checks.some(check => check.isFailed && check.check !== JudicialRecordCheck.Blank)) {
        return JudicialRecordStatus.AutomaticallyRejected;
    }

    if (checks.some(check => !check.isPassed)) {
        return JudicialRecordStatus.UnderReview;
    }

    return JudicialRecordStatus.Approved;
}

function checkIdentity(parsed: ParsedJudicialRecordExtract, member: JudicialRecordMemberIdentity): JudicialRecordCheckResult {
    if (parsed.firstName === null || parsed.lastName === null || parsed.birthDay === null) {
        return result(JudicialRecordCheck.Identity, JudicialRecordCheckStatus.Failed, JudicialRecordCheckExplanation.FieldNotFound);
    }

    const matches = member.birthDay !== null
        && JudicialRecordHelper.isSameName(parsed.firstName, member.firstName)
        && JudicialRecordHelper.isSameName(parsed.lastName, member.lastName)
        && JudicialRecordHelper.isSameBirthDay(parsed.birthDay, member.birthDay);

    if (!matches) {
        return result(JudicialRecordCheck.Identity, JudicialRecordCheckStatus.Failed, JudicialRecordCheckExplanation.IdentityMismatch, {
            name: member.firstName + ' ' + member.lastName,
        });
    }

    return result(JudicialRecordCheck.Identity, JudicialRecordCheckStatus.Passed, JudicialRecordCheckExplanation.IdentityMatches);
}

/**
 * The purpose has to start with the model number, not merely mention it: 596.2 also appears in the
 * boilerplate of other models, and the purpose of another model can name it while being another
 * document.
 */
function checkModel(parsed: ParsedJudicialRecordExtract): JudicialRecordCheckResult {
    if (parsed.purpose === null) {
        return result(JudicialRecordCheck.Model, JudicialRecordCheckStatus.Failed, JudicialRecordCheckExplanation.FieldNotFound);
    }

    if (!parsed.purpose.startsWith('596.2')) {
        return result(JudicialRecordCheck.Model, JudicialRecordCheckStatus.Failed, JudicialRecordCheckExplanation.ModelMismatch);
    }

    return result(JudicialRecordCheck.Model, JudicialRecordCheckStatus.Passed, JudicialRecordCheckExplanation.ModelMatches);
}

function checkAge(parsed: ParsedJudicialRecordExtract, deliveredAt: Date): JudicialRecordCheckResult {
    if (parsed.issuedAt === null) {
        return result(JudicialRecordCheck.Age, JudicialRecordCheckStatus.Failed, JudicialRecordCheckExplanation.FieldNotFound);
    }

    const ageInDays = Math.floor((deliveredAt.getTime() - parsed.issuedAt.getTime()) / (24 * 60 * 60 * 1000));

    if (ageInDays > JUDICIAL_RECORD_MAX_DOCUMENT_AGE_DAYS) {
        return result(JudicialRecordCheck.Age, JudicialRecordCheckStatus.Failed, JudicialRecordCheckExplanation.AgeTooOld, {
            days: JUDICIAL_RECORD_MAX_DOCUMENT_AGE_DAYS.toString(),
        });
    }

    return result(JudicialRecordCheck.Age, JudicialRecordCheckStatus.Passed, JudicialRecordCheckExplanation.AgeWithinLimit);
}

function checkBlank(parsed: ParsedJudicialRecordExtract): JudicialRecordCheckResult {
    if (!parsed.isBlank) {
        return result(JudicialRecordCheck.Blank, JudicialRecordCheckStatus.Failed, JudicialRecordCheckExplanation.IsNotBlank);
    }

    return result(JudicialRecordCheck.Blank, JudicialRecordCheckStatus.Passed, JudicialRecordCheckExplanation.IsBlank);
}

function result(check: JudicialRecordCheck, status: JudicialRecordCheckStatus, explanation: JudicialRecordCheckExplanation | null = null, explanationParams: Record<string, string> = {}): JudicialRecordCheckResult {
    return JudicialRecordCheckResult.create({ check, status, explanation, explanationParams });
}
