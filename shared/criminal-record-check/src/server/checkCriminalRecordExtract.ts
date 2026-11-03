import { CriminalRecordCheck, CriminalRecordCheckExplanation, CriminalRecordCheckResult, CriminalRecordCheckStatus, CriminalRecordDeliveryResponse } from '@stamhoofd/structures';
import { CriminalRecordParseError } from './CriminalRecordParseError.js';
import type { CriminalRecordMemberIdentity } from './evaluateCriminalRecordChecks.js';
import { evaluateCriminalRecordChecks, getCriminalRecordDeliveryStatus, unreadableCriminalRecordChecks } from './evaluateCriminalRecordChecks.js';
import type { PdfParseLimits } from './extractPdfLines.js';
import { extractPdfLines } from './extractPdfLines.js';
import { parseCriminalRecordExtract } from './parseCriminalRecordExtract.js';

export interface CheckCriminalRecordExtractOptions {
    /** The bytes of a pdf. Untrusted input: only compared as plain text, never executed. */
    data: Uint8Array;
    member: CriminalRecordMemberIdentity;
    /** The reference for the age of the document. */
    deliveredAt: Date;
    /**
     * The outcome of the signature verification, which runs before the content is read. It is a
     * parameter because the verification itself is not part of this module: the uploaded pdf and the
     * pdf downloaded through the QR code reach the same checks with a different explanation.
     */
    authentic: CriminalRecordCheckResult;
    limits?: PdfParseLimits;
}

/**
 * Read an extract and run the checks of the automatic control on it.
 *
 * The results are not stored anywhere: a reviewer opening the document later gets them recomputed
 * from the stored file with the original delivery date.
 */
export async function checkCriminalRecordExtract({ data, member, deliveredAt, authentic, limits }: CheckCriminalRecordExtractOptions): Promise<CriminalRecordDeliveryResponse> {
    const checks = await runChecks({ data, member, deliveredAt, authentic, limits });

    return CriminalRecordDeliveryResponse.create({
        status: getCriminalRecordDeliveryStatus(checks),
        checks,
    });
}

/**
 * The authentic check as long as the signature verification has not run. A document whose signature
 * was not verified is never approved automatically: it goes to a reviewer.
 */
export function unverifiedSignatureCheck(): CriminalRecordCheckResult {
    return CriminalRecordCheckResult.create({
        check: CriminalRecordCheck.Authentic,
        status: CriminalRecordCheckStatus.NotStarted,
        explanation: CriminalRecordCheckExplanation.SignatureNotVerified,
    });
}

async function runChecks({ data, member, deliveredAt, authentic, limits }: CheckCriminalRecordExtractOptions): Promise<CriminalRecordCheckResult[]> {
    try {
        const lines = await extractPdfLines(data, limits);
        const parsed = parseCriminalRecordExtract(lines);

        return evaluateCriminalRecordChecks({ parsed, member, deliveredAt, authentic });
    } catch (error) {
        if (error instanceof CriminalRecordParseError) {
            return unreadableCriminalRecordChecks(error.code, authentic);
        }

        throw error;
    }
}
