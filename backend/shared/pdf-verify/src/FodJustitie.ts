import { FOD_JUSTITIE_SIGNATURE_POLICY } from '@stamhoofd/pdf-verify-core';
import { verifyPdf } from './verifyPdf.js';

export async function verifyPdfFromFodJustitie(bytes: Uint8Array, maximumAgeInDays: number): Promise<void> {
    await verifyPdf(bytes, FOD_JUSTITIE_SIGNATURE_POLICY, maximumAgeInDays);
}
