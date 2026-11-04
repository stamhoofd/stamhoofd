import { isSimpleError } from '@common/errors';
import type { SimpleError } from '@common/errors';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type * as pkijs from 'pkijs';
import { CrlCache } from '../src/CrlCache.js';
import { assertChainNotRevoked, checkCertificateRevocation } from '../src/Revocation.js';
import type { TestCertificate } from './helpers/RevocationFixtures.js';
import { createCrl, createOcspResponse, issueCertificate, StubRevocationHttpClient } from './helpers/RevocationFixtures.js';

const OCSP_URL = 'http://ocsp.example.com/signing';
const CRL_URL = 'http://crl.example.com/signing.crl';
const NOW = new Date('2026-11-04T12:00:00Z');

function setNow(date: Date) {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] }).setSystemTime(date);
}
const SIGNER_NAME = 'Signing Authority';

describe('checkCertificateRevocation', () => {
    let issuer: TestCertificate;
    let signer: TestCertificate;
    let client: StubRevocationHttpClient;
    let cache: CrlCache;

    function options() {
        return { client, cache };
    }

    beforeEach(async () => {
        issuer = await issueCertificate({ commonName: 'Test Document CA', isCertificateAuthority: true });
        signer = await issueCertificate({ commonName: 'Test Signer', issuer, ocspUrl: OCSP_URL, crlUrl: CRL_URL });
        client = new StubRevocationHttpClient();
        cache = new CrlCache();
        setNow(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('accepts a certificate the responder calls good, without reading the list', async () => {
        client.answer(OCSP_URL, await createOcspResponse({ certificate: signer.certificate, issuer, status: 'good' }));

        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('good');
        expect(client.calls).toEqual([`POST ${OCSP_URL}`]);
    });

    test('refuses a certificate the responder calls revoked', async () => {
        client.answer(OCSP_URL, await createOcspResponse({ certificate: signer.certificate, issuer, status: 'revoked' }));

        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('revoked');
    });

    test('falls back to the revocation list when the responder cannot be reached', async () => {
        client.answer(OCSP_URL, new Error('connect timeout'));
        client.answer(CRL_URL, await createCrl({ issuer }));

        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('good');
        expect(client.calls).toEqual([`POST ${OCSP_URL}`, `GET ${CRL_URL}`]);
    });

    test('finds a revoked certificate on the list', async () => {
        client.answer(OCSP_URL, new Error('connect timeout'));
        client.answer(CRL_URL, await createCrl({ issuer, revoked: [signer.certificate] }));

        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('revoked');
    });

    test('falls back when the responder answers that it will not answer', async () => {
        client.answer(OCSP_URL, await createOcspResponse({ certificate: signer.certificate, issuer, status: 'good', responseStatus: 3 }));
        client.answer(CRL_URL, await createCrl({ issuer, revoked: [signer.certificate] }));

        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('revoked');
    });

    test('does not believe a response signed by someone else', async () => {
        const stranger = await issueCertificate({ commonName: 'Stranger CA', isCertificateAuthority: true });
        client.answer(OCSP_URL, await createOcspResponse({ certificate: signer.certificate, issuer, status: 'good', signedBy: stranger }));
        client.answer(CRL_URL, await createCrl({ issuer, revoked: [signer.certificate] }));

        // The response says good, the list says revoked, and only one of the two is the issuer's
        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('revoked');
    });

    test('does not believe a response about another certificate', async () => {
        const other = await issueCertificate({ commonName: 'Other Signer', issuer });
        client.answer(OCSP_URL, await createOcspResponse({ certificate: signer.certificate, issuer, status: 'good', about: other.certificate }));
        client.answer(CRL_URL, new Error('connect timeout'));

        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('unknown');
    });

    test('does not believe a list signed by someone else', async () => {
        const stranger = await issueCertificate({ commonName: 'Stranger CA', isCertificateAuthority: true });
        client.answer(OCSP_URL, new Error('connect timeout'));
        client.answer(CRL_URL, await createCrl({ issuer, signedBy: stranger }));

        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('unknown');
    });

    test('does not believe a list that is no longer current', async () => {
        client.answer(OCSP_URL, new Error('connect timeout'));
        client.answer(CRL_URL, await createCrl({ issuer, nextUpdate: new Date('2026-11-03T00:00:00Z') }));

        expect(await checkCertificateRevocation(signer.certificate, issuer.certificate, options())).toBe('unknown');
    });

    test('is unknown when the certificate says nowhere to ask', async () => {
        const withoutUrls = await issueCertificate({ commonName: 'Silent Signer', issuer });

        expect(await checkCertificateRevocation(withoutUrls.certificate, issuer.certificate, options())).toBe('unknown');
        expect(client.calls).toEqual([]);
    });

    test('reads a cached list rather than fetching it again', async () => {
        client.answer(OCSP_URL, new Error('connect timeout'));
        client.answer(CRL_URL, await createCrl({ issuer }));

        await checkCertificateRevocation(signer.certificate, issuer.certificate, options());
        await checkCertificateRevocation(signer.certificate, issuer.certificate, options());

        expect(client.calls.filter(call => call.startsWith('GET'))).toEqual([`GET ${CRL_URL}`]);
    });

    test('fetches again once the list it cached has expired', async () => {
        client.answer(OCSP_URL, new Error('connect timeout'));
        client.answer(CRL_URL, await createCrl({ issuer, nextUpdate: new Date('2026-11-05T00:00:00Z') }));

        await checkCertificateRevocation(signer.certificate, issuer.certificate, options());
        setNow(new Date('2026-11-06T12:00:00Z'));
        await checkCertificateRevocation(signer.certificate, issuer.certificate, options());

        expect(client.calls.filter(call => call.startsWith('GET'))).toEqual([`GET ${CRL_URL}`, `GET ${CRL_URL}`]);
    });
});

describe('assertChainNotRevoked', () => {
    let anchor: TestCertificate;
    let intermediate: TestCertificate;
    let signer: TestCertificate;
    let client: StubRevocationHttpClient;

    const intermediateOcspUrl = 'http://ocsp.example.com/root';

    function chain(): { certificate: pkijs.Certificate; issuer: pkijs.Certificate; name: string }[] {
        return [
            { certificate: signer.certificate, issuer: intermediate.certificate, name: 'Test Signer' },
            { certificate: intermediate.certificate, issuer: anchor.certificate, name: 'Test AATL CA' },
        ];
    }

    async function expectFailure(code: string) {
        const thrown = await assertChainNotRevoked(chain(), SIGNER_NAME, { client }).then(() => null, (error: unknown) => error);

        expect(isSimpleError(thrown)).toBe(true);
        expect((thrown as SimpleError).code).toBe(code);
        expect((thrown as SimpleError).human).toBeTruthy();
        expect((thrown as SimpleError).human).not.toContain('{');

        return thrown as SimpleError;
    }

    beforeEach(async () => {
        anchor = await issueCertificate({ commonName: 'Test Document Signing Root', isCertificateAuthority: true });
        intermediate = await issueCertificate({ commonName: 'Test AATL CA', issuer: anchor, isCertificateAuthority: true, ocspUrl: intermediateOcspUrl });
        signer = await issueCertificate({ commonName: 'Test Signer', issuer: intermediate, ocspUrl: OCSP_URL });
        client = new StubRevocationHttpClient();
        setNow(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('accepts a chain of certificates that are all good', async () => {
        client.answer(OCSP_URL, await createOcspResponse({ certificate: signer.certificate, issuer: intermediate, status: 'good' }));
        client.answer(intermediateOcspUrl, await createOcspResponse({ certificate: intermediate.certificate, issuer: anchor, status: 'good' }));

        await expect(assertChainNotRevoked(chain(), SIGNER_NAME, { client })).resolves.toBeUndefined();
    });

    test('rejects the chain when an intermediate was revoked, and says which one', async () => {
        client.answer(OCSP_URL, await createOcspResponse({ certificate: signer.certificate, issuer: intermediate, status: 'good' }));
        client.answer(intermediateOcspUrl, await createOcspResponse({ certificate: intermediate.certificate, issuer: anchor, status: 'revoked' }));

        const error = await expectFailure('certificate_revoked');

        expect(error.message).toContain('Test AATL CA');
    });

    test('rejects with a code of its own when a status could not be established', async () => {
        client.answer(OCSP_URL, await createOcspResponse({ certificate: signer.certificate, issuer: intermediate, status: 'good' }));
        client.answer(intermediateOcspUrl, new Error('connect timeout'));

        await expectFailure('revocation_unavailable');
    });

    test('lets a revoked certificate outweigh one it could not establish', async () => {
        client.answer(OCSP_URL, new Error('connect timeout'));
        client.answer(intermediateOcspUrl, await createOcspResponse({ certificate: intermediate.certificate, issuer: anchor, status: 'revoked' }));

        await expectFailure('certificate_revoked');
    });
});
