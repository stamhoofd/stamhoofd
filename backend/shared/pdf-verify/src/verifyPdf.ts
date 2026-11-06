import type { PdfSignaturePolicy } from '@stamhoofd/pdf-verify-core';
import { verifyPdfSignature } from '@stamhoofd/pdf-verify-core';
import { toCertificateChain } from './CertificateChain.js';
import { assertChainNotRevoked } from './Revocation.js';

/**
 * Verifies that `bytes` is an unmodified PDF signed by the signer the policy pins, and that no
 * certificate behind that signature is revoked.
 *
 * Answers with the moment the signature says it was made. That date is one of the signed attributes,
 * so it comes out of the signature rather than off the document: it is as established as the
 * authenticity itself, which is what makes it the one worth storing.
 *
 * Throws a `SimpleError` on every rejection.
 */
export async function verifyPdf(bytes: Uint8Array, policy: PdfSignaturePolicy, maximumAgeInDays: number): Promise<Date> {
    const { signedAt, certificatePath } = await verifyPdfSignature(bytes, policy, maximumAgeInDays);

    await assertChainNotRevoked(toCertificateChain(certificatePath), policy.signerName);

    return signedAt;
}
