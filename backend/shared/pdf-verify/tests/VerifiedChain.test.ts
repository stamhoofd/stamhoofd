import { describe, expect, test } from 'vitest';

import { buildCertificateChain } from '../src/VerifiedChain.js';
import { issueCertificate } from './helpers/RevocationFixtures.js';

describe('buildCertificateChain', () => {
    test('pairs every certificate with its issuer, from the signer up to the anchor', async () => {
        const anchor = await issueCertificate({ commonName: 'Root', isCertificateAuthority: true });
        const intermediate = await issueCertificate({ commonName: 'CA', issuer: anchor, isCertificateAuthority: true });
        const signer = await issueCertificate({ commonName: 'Signer', issuer: intermediate });

        const chain = buildCertificateChain(signer.certificate, [signer.certificate, intermediate.certificate], anchor.certificate);

        expect(chain.map(link => [link.name, link.issuer.subject.typesAndValues[0].value.valueBlock.value])).toEqual([
            ['Signer', 'CA'],
            ['CA', 'Root'],
        ]);
    });

    test('leaves out the anchor, which is pinned rather than looked up', async () => {
        const anchor = await issueCertificate({ commonName: 'Root', isCertificateAuthority: true });
        const signer = await issueCertificate({ commonName: 'Signer', issuer: anchor });

        const chain = buildCertificateChain(signer.certificate, [signer.certificate], anchor.certificate);

        expect(chain.map(link => link.name)).toEqual(['Signer']);
    });

    test('returns nothing when the issuer of a certificate is not in the file', async () => {
        const anchor = await issueCertificate({ commonName: 'Root', isCertificateAuthority: true });
        const missing = await issueCertificate({ commonName: 'Missing CA', issuer: anchor, isCertificateAuthority: true });
        const signer = await issueCertificate({ commonName: 'Signer', issuer: missing });

        expect(buildCertificateChain(signer.certificate, [signer.certificate], anchor.certificate)).toEqual([]);
    });
});
