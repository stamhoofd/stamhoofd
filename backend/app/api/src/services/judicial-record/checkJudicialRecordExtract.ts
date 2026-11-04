import { isSimpleError } from '@common/errors';
import { extractPdfLines } from '@stamhoofd/pdf-parse';
import type { JudicialRecordCheckResult } from '@stamhoofd/structures';
import { JudicialRecordDeliveryResponse } from '@stamhoofd/structures';
import type { JudicialRecordMemberIdentity } from './evaluateJudicialRecordChecks.js';
import { evaluateJudicialRecordChecks, getJudicialRecordDeliveryStatus, notStartedJudicialRecordChecks, unreadableJudicialRecordChecks } from './evaluateJudicialRecordChecks.js';
import { JudicialRecordLayoutError, parseJudicialRecordExtract } from './parseJudicialRecordExtract.js';
import { verifyJudicialRecordSignature } from './verifyJudicialRecordSignature.js';

export interface JudicialRecordExtractOptions {
    /** Untrusted input: the text of a pdf is only ever compared as plain text. */
    data: Uint8Array;
    member: JudicialRecordMemberIdentity;
    /** The reference for the age of the document. */
    deliveredAt: Date;
}

/**
 * The signature of FOD Justitie first, then the content of the document.
 *
 * Results are never stored: a reviewer opening the document later gets them recomputed, with the
 * original delivery date as the reference.
 */
export async function checkJudicialRecordExtract({ data, member, deliveredAt }: JudicialRecordExtractOptions): Promise<JudicialRecordDeliveryResponse> {
    const authentic = await verifyJudicialRecordSignature(data);

    if (!authentic.isPassed) {
        // The text of a document we cannot place is not worth reading, so the content is not parsed
        return respond([authentic, ...notStartedJudicialRecordChecks()]);
    }

    return await checkJudicialRecordExtractContent({ data, member, deliveredAt, authentic });
}

/**
 * The signature check is an argument because it has two sources: the signature of an uploaded pdf,
 * and a document we downloaded at FOD Justitie ourselves through the QR code.
 */
export async function checkJudicialRecordExtractContent({ data, member, deliveredAt, authentic }: JudicialRecordExtractOptions & { authentic: JudicialRecordCheckResult }): Promise<JudicialRecordDeliveryResponse> {
    return respond(await runContentChecks({ data, member, deliveredAt, authentic }));
}

function respond(checks: JudicialRecordCheckResult[]): JudicialRecordDeliveryResponse {
    return JudicialRecordDeliveryResponse.create({
        status: getJudicialRecordDeliveryStatus(checks),
        checks,
    });
}

async function runContentChecks({ data, member, deliveredAt, authentic }: JudicialRecordExtractOptions & { authentic: JudicialRecordCheckResult }): Promise<JudicialRecordCheckResult[]> {
    let lines: string[];

    try {
        lines = await extractPdfLines(data);
    } catch (error) {
        // Not a pdf we can read the text of: no text layer, or beyond the limits the package accepts
        if (!isSimpleError(error)) {
            throw error;
        }

        return unreadableJudicialRecordChecks(error.code, authentic);
    }

    try {
        const parsed = parseJudicialRecordExtract(lines);

        return evaluateJudicialRecordChecks({ parsed, member, deliveredAt, authentic });
    } catch (error) {
        // Text we can read but not place: another model, another language, a tampered file
        if (error instanceof JudicialRecordLayoutError) {
            return unreadableJudicialRecordChecks(error.code, authentic);
        }

        throw error;
    }
}
