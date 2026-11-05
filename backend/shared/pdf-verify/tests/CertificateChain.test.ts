import { describe, expect, test } from 'vitest';

import { createSignedPdf, createTestChain, issueCertificate } from '@stamhoofd/pdf-verify-core/testing/SignedPdfBuilder.js';
import { verifyPdfSignature } from '@stamhoofd/pdf-verify-core';
import { toCertificateChain } from '../src/CertificateChain.js';

const NO_AGE_LIMIT = 36500;

describe('the chain the revocation lookup runs over', () => {
    test('is the one the signature was validated against, not whichever certificate carries the right name', async () => {
        const chain = await createTestChain();

        // The CMS certificate set is not covered by the signature, and the container sits outside the
        // byte range, so this set can be edited on a genuine document. This one carries the subject
        // of the real intermediate on a key of its own, ahead of the real one.
        const decoy = await issueCertificate({
            subject: [['2.5.4.3', 'Test AATL CA'], ['2.5.4.10', 'Test nv-sa']],
            isCertificateAuthority: true,
        });

        const bytes = await createSignedPdf({
            chain,
            embedCertificates: [chain.signer.certificate, decoy.certificate, chain.intermediate.certificate, chain.anchor.certificate],
        });

        // The signature itself still validates: the decoy signed nothing, so no path runs through it.
        const { certificatePath } = await verifyPdfSignature(bytes, chain.policy, NO_AGE_LIMIT);
        const links = toCertificateChain(certificatePath);

        expect(links).toHaveLength(2);
        expect(links[0].issuer.subjectPublicKeyInfo.subjectPublicKey.isEqual(chain.intermediate.certificate.subjectPublicKeyInfo.subjectPublicKey)).toBe(true);
        expect(links[0].issuer.subjectPublicKeyInfo.subjectPublicKey.isEqual(decoy.certificate.subjectPublicKeyInfo.subjectPublicKey)).toBe(false);
        expect(links[1].issuer.subjectPublicKeyInfo.subjectPublicKey.isEqual(chain.anchor.certificate.subjectPublicKeyInfo.subjectPublicKey)).toBe(true);
    });
});
