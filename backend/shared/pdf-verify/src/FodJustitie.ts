import { FOD_JUSTITIE_SIGNATURE_POLICY } from '@stamhoofd/pdf-verify-core';
import { verifyPdf } from './verifyPdf.js';

/** Answers with the moment the signature says it was made. See `verifyPdf`. */
export async function verifyPdfFromFodJustitie(bytes: Uint8Array, maximumAgeInDays: number): Promise<Date> {
    return await verifyPdf(bytes, FOD_JUSTITIE_SIGNATURE_POLICY, maximumAgeInDays);
}
