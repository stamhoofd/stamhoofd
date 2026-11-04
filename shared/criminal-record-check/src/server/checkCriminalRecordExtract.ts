import type { CriminalRecordCheckResult } from '@stamhoofd/structures';
import { CriminalRecordDeliveryResponse } from '@stamhoofd/structures';
import { CriminalRecordParseError } from './CriminalRecordParseError.js';
import type { CriminalRecordMemberIdentity } from './evaluateCriminalRecordChecks.js';
import { evaluateCriminalRecordChecks, getCriminalRecordDeliveryStatus, notStartedCriminalRecordChecks, unreadableCriminalRecordChecks } from './evaluateCriminalRecordChecks.js';
import type { PdfParseLimits } from './extractPdfLines.js';
import { extractPdfLines } from './extractPdfLines.js';
import { parseCriminalRecordExtract } from './parseCriminalRecordExtract.js';
import { verifyCriminalRecordSignature } from './verifyCriminalRecordSignature.js';

export interface CheckCriminalRecordExtractOptions {
    /** The bytes of a pdf. Untrusted input: only compared as plain text, never executed. */
    data: Uint8Array;
    member: CriminalRecordMemberIdentity;
    /** The reference for the age of the document. */
    deliveredAt: Date;
    limits?: PdfParseLimits;
}

/**
 * Check a delivered extract: verify the signature of FOD Justitie, then read the document and run
 * the checks on its content.
 *
 * The results are not stored anywhere: a reviewer opening the document later gets them recomputed
 * from the stored file with the original delivery date.
 */
export async function checkCriminalRecordExtract({ data, member, deliveredAt, limits }: CheckCriminalRecordExtractOptions): Promise<CriminalRecordDeliveryResponse> {
    const authentic = await verifyCriminalRecordSignature(data);

    if (!authentic.isPassed) {
        // The text of a document we cannot place is not worth reading, so the content is not parsed
        return respond([authentic, ...notStartedCriminalRecordChecks()]);
    }

    return await checkCriminalRecordExtractContent({ data, member, deliveredAt, authentic, limits });
}

/**
 * The content half: read the document and run the four checks on what it says.
 *
 * The signature check is passed in, because its own two outcomes - the signature of an uploaded pdf,
 * and a document downloaded at FOD Justitie through the QR code - are established before the content
 * is read, and only a document that passed one of them ever reaches this.
 */
export async function checkCriminalRecordExtractContent({ data, member, deliveredAt, authentic, limits }: CheckCriminalRecordExtractOptions & { authentic: CriminalRecordCheckResult }): Promise<CriminalRecordDeliveryResponse> {
    return respond(await runContentChecks({ data, member, deliveredAt, authentic, limits }));
}

function respond(checks: CriminalRecordCheckResult[]): CriminalRecordDeliveryResponse {
    return CriminalRecordDeliveryResponse.create({
        status: getCriminalRecordDeliveryStatus(checks),
        checks,
    });
}

async function runContentChecks({ data, member, deliveredAt, authentic, limits }: CheckCriminalRecordExtractOptions & { authentic: CriminalRecordCheckResult }): Promise<CriminalRecordCheckResult[]> {
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
