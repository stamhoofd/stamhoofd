import { FOD_JUSTITIE_SIGNATURE_POLICY } from './FodJustitieSignaturePolicy.js';
import type { VerifiedPdfSignature } from './verifyPdfSignature.js';
import { verifyPdfSignature } from './verifyPdfSignature.js';

/**
 * Verifies that `bytes` is an unmodified pdf signed by FOD Justitie, the signer of a Belgian
 * *uittreksel uit het strafregister*. See `verifyPdfSignature`: this only pins the policy.
 */
export async function verifyPdfFromFodJustitie(bytes: Uint8Array, maxAgeInDays: number): Promise<VerifiedPdfSignature> {
    return await verifyPdfSignature(bytes, FOD_JUSTITIE_SIGNATURE_POLICY, maxAgeInDays);
}
