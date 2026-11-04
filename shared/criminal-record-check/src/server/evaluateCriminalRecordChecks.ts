import { CRIMINAL_RECORD_MAX_DOCUMENT_AGE_DAYS, CriminalRecordCheck, CriminalRecordCheckExplanation, CriminalRecordCheckResult, CriminalRecordCheckStatus, CriminalRecordHelper, CriminalRecordStatus } from '@stamhoofd/structures';
import type { CriminalRecordParseErrorCode } from './CriminalRecordParseError.js';
import type { ParsedCriminalRecordExtract } from './parseCriminalRecordExtract.js';

export interface CriminalRecordMemberIdentity {
    firstName: string;
    lastName: string;
    birthDay: Date | null;
}

export interface EvaluateCriminalRecordChecksOptions {
    parsed: ParsedCriminalRecordExtract;
    member: CriminalRecordMemberIdentity;
    /** The reference for the age of the document, so a document cannot age out while it waits in the queue. */
    deliveredAt: Date;
    /** The result of the signature verification, which runs before the content is read. */
    authentic: CriminalRecordCheckResult;
}

/**
 * The five checks of the automatic control, in the order they are shown.
 */
export function evaluateCriminalRecordChecks({ parsed, member, deliveredAt, authentic }: EvaluateCriminalRecordChecksOptions): CriminalRecordCheckResult[] {
    return [
        authentic,
        checkIdentity(parsed, member),
        checkModel(parsed),
        checkAge(parsed, deliveredAt),
        checkBlank(parsed),
    ];
}

/**
 * The checks for a document we could not read. The parse error itself is the explanation, so the
 * member is told we could not read the document rather than that the document is wrong.
 */
export function unreadableCriminalRecordChecks(code: CriminalRecordParseErrorCode, authentic: CriminalRecordCheckResult): CriminalRecordCheckResult[] {
    return [
        authentic,
        ...CONTENT_CHECKS.map(check => result(check, CriminalRecordCheckStatus.Failed, CriminalRecordCheckExplanation.DocumentNotReadable, { code })),
    ];
}

/** The four checks that read the content of the document, in the order they are shown. */
const CONTENT_CHECKS = [CriminalRecordCheck.Identity, CriminalRecordCheck.Model, CriminalRecordCheck.Age, CriminalRecordCheck.Blank];

/**
 * The content checks of a document that was not read: the signature did not hold, so the text is
 * not worth reading.
 */
export function notStartedCriminalRecordChecks(): CriminalRecordCheckResult[] {
    return CONTENT_CHECKS.map(check => result(check, CriminalRecordCheckStatus.NotStarted));
}

/**
 * The status a delivery results in.
 *
 * Not blank is never by itself a reason for an automatic rejection: when every other check passes,
 * the document goes straight to a reviewer. A check that did not run yet goes there as well, so a
 * document can never be approved on checks we did not perform.
 */
export function getCriminalRecordDeliveryStatus(checks: CriminalRecordCheckResult[]): CriminalRecordStatus {
    if (checks.some(check => check.isFailed && check.check !== CriminalRecordCheck.Blank)) {
        return CriminalRecordStatus.AutomaticallyRejected;
    }

    if (checks.some(check => !check.isPassed)) {
        return CriminalRecordStatus.UnderReview;
    }

    return CriminalRecordStatus.Approved;
}

function checkIdentity(parsed: ParsedCriminalRecordExtract, member: CriminalRecordMemberIdentity): CriminalRecordCheckResult {
    if (parsed.firstName === null || parsed.lastName === null || parsed.birthDay === null) {
        return result(CriminalRecordCheck.Identity, CriminalRecordCheckStatus.Failed, CriminalRecordCheckExplanation.FieldNotFound);
    }

    const matches = member.birthDay !== null
        && CriminalRecordHelper.isSameName(parsed.firstName, member.firstName)
        && CriminalRecordHelper.isSameName(parsed.lastName, member.lastName)
        && CriminalRecordHelper.isSameBirthDay(parsed.birthDay, member.birthDay);

    if (!matches) {
        return result(CriminalRecordCheck.Identity, CriminalRecordCheckStatus.Failed, CriminalRecordCheckExplanation.IdentityMismatch, {
            name: member.firstName + ' ' + member.lastName,
        });
    }

    return result(CriminalRecordCheck.Identity, CriminalRecordCheckStatus.Passed, CriminalRecordCheckExplanation.IdentityMatches);
}

/**
 * Model 596.2 is read from the purpose of the extract, not from the text as a whole: 596.2 also
 * appears in the boilerplate of other models.
 */
function checkModel(parsed: ParsedCriminalRecordExtract): CriminalRecordCheckResult {
    if (parsed.purpose === null) {
        return result(CriminalRecordCheck.Model, CriminalRecordCheckStatus.Failed, CriminalRecordCheckExplanation.FieldNotFound);
    }

    if (!parsed.purpose.includes('596.2')) {
        return result(CriminalRecordCheck.Model, CriminalRecordCheckStatus.Failed, CriminalRecordCheckExplanation.ModelMismatch);
    }

    return result(CriminalRecordCheck.Model, CriminalRecordCheckStatus.Passed, CriminalRecordCheckExplanation.ModelMatches);
}

function checkAge(parsed: ParsedCriminalRecordExtract, deliveredAt: Date): CriminalRecordCheckResult {
    if (parsed.issuedAt === null) {
        return result(CriminalRecordCheck.Age, CriminalRecordCheckStatus.Failed, CriminalRecordCheckExplanation.FieldNotFound);
    }

    const ageInDays = Math.floor((deliveredAt.getTime() - parsed.issuedAt.getTime()) / (24 * 60 * 60 * 1000));

    if (ageInDays > CRIMINAL_RECORD_MAX_DOCUMENT_AGE_DAYS) {
        return result(CriminalRecordCheck.Age, CriminalRecordCheckStatus.Failed, CriminalRecordCheckExplanation.AgeTooOld, {
            days: CRIMINAL_RECORD_MAX_DOCUMENT_AGE_DAYS.toString(),
        });
    }

    return result(CriminalRecordCheck.Age, CriminalRecordCheckStatus.Passed, CriminalRecordCheckExplanation.AgeWithinLimit);
}

function checkBlank(parsed: ParsedCriminalRecordExtract): CriminalRecordCheckResult {
    if (!parsed.isBlank) {
        return result(CriminalRecordCheck.Blank, CriminalRecordCheckStatus.Failed, CriminalRecordCheckExplanation.IsNotBlank);
    }

    return result(CriminalRecordCheck.Blank, CriminalRecordCheckStatus.Passed, CriminalRecordCheckExplanation.IsBlank);
}

function result(check: CriminalRecordCheck, status: CriminalRecordCheckStatus, explanation: CriminalRecordCheckExplanation | null = null, explanationParams: Record<string, string> = {}): CriminalRecordCheckResult {
    return CriminalRecordCheckResult.create({ check, status, explanation, explanationParams });
}
