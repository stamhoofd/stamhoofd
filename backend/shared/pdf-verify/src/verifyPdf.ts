import { SimpleError } from '@common/errors';
import type { PdfSignaturePolicy } from '@stamhoofd/pdf-verify-core';
import { verifyPdfSignature } from '@stamhoofd/pdf-verify-core';
import { assertChainNotRevoked } from './Revocation.js';
import { readVerifiedChain } from './VerifiedChain.js';

/**
 * Verifies that `bytes` is an unmodified PDF signed by the signer the policy pins, and that no
 * certificate behind that signature is revoked.
 *
 * Throws a `SimpleError` on every rejection.
 */
export async function verifyPdf(bytes: Uint8Array, policy: PdfSignaturePolicy, maximumAgeInDays: number): Promise<void> {
    await verifyPdfSignature(bytes, policy, maximumAgeInDays);

    const chain = readVerifiedChain(bytes, policy);

    if (chain.length === 0) {
        throw new SimpleError({
            code: 'unreadable_certificate_chain',
            message: 'The chain of a verified signature could not be read back.',
            human: $t('We konden dit bestand even niet volledig controleren. Probeer het straks opnieuw.'),
            statusCode: 500,
        });
    }

    await assertChainNotRevoked(chain, policy.signerName);
}
