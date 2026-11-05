import type { PdfSignaturePolicy } from '@stamhoofd/pdf-verify-core';
import { verifyPdfSignature } from '@stamhoofd/pdf-verify-core';
import { toCertificateChain } from './CertificateChain.js';
import { assertChainNotRevoked } from './Revocation.js';

/**
 * Verifies that `bytes` is an unmodified PDF signed by the signer the policy pins, and that no
 * certificate behind that signature is revoked.
 *
 * Throws a `SimpleError` on every rejection.
 */
export async function verifyPdf(bytes: Uint8Array, policy: PdfSignaturePolicy, maximumAgeInDays: number): Promise<void> {
    const certificatePath = await verifyPdfSignature(bytes, policy, maximumAgeInDays);

    await assertChainNotRevoked(toCertificateChain(certificatePath), policy.signerName);
}
