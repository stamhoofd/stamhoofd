import { isSimpleError } from '@common/errors';
import { verifyPdfFromFodJustitie } from '@stamhoofd/pdf-verify';
import { JUDICIAL_RECORD_MAX_DOCUMENT_AGE_DAYS, JudicialRecordCheck, JudicialRecordCheckExplanation, JudicialRecordCheckResult, JudicialRecordCheckStatus } from '@stamhoofd/structures';

/**
 * The first check: an unmodified pdf, signed by FOD Justitie, with certificates that are not
 * revoked. The frontend runs the signature half before uploading, for the user experience; this is
 * the one that counts, and it is what makes the text of the document worth reading.
 */
export async function verifyJudicialRecordSignature(data: Uint8Array): Promise<JudicialRecordCheckResult> {
    try {
        await verifyPdfFromFodJustitie(data, JUDICIAL_RECORD_MAX_DOCUMENT_AGE_DAYS);
    } catch (error) {
        if (!isSimpleError(error)) {
            throw error;
        }

        return JudicialRecordCheckResult.create({
            check: JudicialRecordCheck.Authentic,
            status: JudicialRecordCheckStatus.Failed,
            explanation: JudicialRecordCheckExplanation.SignatureInvalid,
            // Which step refused it: tells a scan apart from a modified file, and makes a
            // certificate rotation at FOD Justitie visible instead of one opaque refusal
            explanationParams: { code: error.code },
        });
    }

    return JudicialRecordCheckResult.create({
        check: JudicialRecordCheck.Authentic,
        status: JudicialRecordCheckStatus.Passed,
        explanation: JudicialRecordCheckExplanation.SignedByJustice,
    });
}
