import { describe, expect, test } from 'vitest';

import { toCertificateChain } from '../src/CertificateChain.js';
import { issueCertificate } from './helpers/RevocationFixtures.js';

describe('the chain the revocation lookup runs over', () => {
    test('pairs every certificate of the path with the next one, and leaves the anchor out', async () => {
        const anchor = await issueCertificate({ commonName: 'Test Document Signing Root', isCertificateAuthority: true });
        const intermediate = await issueCertificate({ commonName: 'Test AATL CA', issuer: anchor, isCertificateAuthority: true });
        const signer = await issueCertificate({ commonName: 'Test Signer', issuer: intermediate });

        const links = toCertificateChain([signer.certificate, intermediate.certificate, anchor.certificate]);

        // Two links for three certificates: the anchor is pinned by the hash of its public key, so
        // there is nothing to ask an authority about it.
        expect(links).toHaveLength(2);
        expect(links[0].name).toBe('Test Signer');
        expect(links[0].issuer.subjectPublicKeyInfo.subjectPublicKey.isEqual(intermediate.certificate.subjectPublicKeyInfo.subjectPublicKey)).toBe(true);
        expect(links[1].name).toBe('Test AATL CA');
        expect(links[1].issuer.subjectPublicKeyInfo.subjectPublicKey.isEqual(anchor.certificate.subjectPublicKeyInfo.subjectPublicKey)).toBe(true);
    });

    test('is empty for a path that is nothing but an anchor', async () => {
        const anchor = await issueCertificate({ commonName: 'Test Document Signing Root', isCertificateAuthority: true });

        expect(toCertificateChain([anchor.certificate])).toEqual([]);
    });
});
