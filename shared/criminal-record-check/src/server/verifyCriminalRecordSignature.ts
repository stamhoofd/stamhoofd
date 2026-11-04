import { SimpleError } from '@common/errors';
import { FOD_JUSTITIE_SIGNATURE_POLICY, verifyPdfSignature } from '@stamhoofd/pdf-signature';
import { CRIMINAL_RECORD_MAX_DOCUMENT_AGE_DAYS, CriminalRecordCheck, CriminalRecordCheckExplanation, CriminalRecordCheckResult, CriminalRecordCheckStatus } from '@stamhoofd/structures';

/**
 * The maximum size of a file we are willing to check. The signature verification refuses anything
 * larger once the bytes are in memory, so the upload itself should already be capped at this.
 */
export const CRIMINAL_RECORD_MAX_FILE_SIZE = FOD_JUSTITIE_SIGNATURE_POLICY.maximumFileSize;

/**
 * The first check: is this an unmodified pdf, digitally signed by FOD Justitie?
 *
 * The frontend runs the same verification before uploading, purely for the user experience. This is
 * the one that counts, and it is also what makes the text of the document worth reading: we only
 * ever parse a document whose signature holds.
 */
export async function verifyCriminalRecordSignature(data: Uint8Array): Promise<CriminalRecordCheckResult> {
    try {
        await verifyPdfSignature(data, FOD_JUSTITIE_SIGNATURE_POLICY, CRIMINAL_RECORD_MAX_DOCUMENT_AGE_DAYS);
    } catch (error) {
        if (!(error instanceof SimpleError)) {
            // Not a rejection but a failure of the verification itself, which is not the member's problem
            throw error;
        }

        return CriminalRecordCheckResult.create({
            check: CriminalRecordCheck.Authentic,
            status: CriminalRecordCheckStatus.Failed,
            explanation: CriminalRecordCheckExplanation.SignatureInvalid,
            explanationParams: { code: error.code },
        });
    }

    return CriminalRecordCheckResult.create({
        check: CriminalRecordCheck.Authentic,
        status: CriminalRecordCheckStatus.Passed,
        explanation: CriminalRecordCheckExplanation.SignedByJustice,
    });
}
