import { isSimpleError } from '@common/errors';
import type { SimpleError } from '@common/errors';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { FOD_JUSTITIE_SIGNATURE_POLICY } from '@stamhoofd/pdf-verify-core';
import type { TestChain } from '@stamhoofd/pdf-verify-core/testing/SignedPdfBuilder.js';
import { createSignedPdf, createTestChain } from '@stamhoofd/pdf-verify-core/testing/SignedPdfBuilder.js';
import { verifyPdf } from '../src/verifyPdf.js';
import { createOcspResponse } from './helpers/RevocationFixtures.js';

const MAXIMUM_AGE_IN_DAYS = 31;

describe('verifyPdf', () => {
    async function expectFailure(bytes: Uint8Array, code: string) {
        const thrown = await verifyPdf(bytes, FOD_JUSTITIE_SIGNATURE_POLICY, MAXIMUM_AGE_IN_DAYS).then(() => null, (error: unknown) => error);

        expect(isSimpleError(thrown)).toBe(true);
        expect((thrown as SimpleError).code).toBe(code);
        expect((thrown as SimpleError).human).toBeTruthy();
        expect((thrown as SimpleError).human).not.toContain('{');
    }

    test('rejects a file that is not a pdf', async () => {
        await expectFailure(new Uint8Array(Buffer.from('This is not a pdf')), 'not_a_pdf');
    });

    test('rejects a pdf that carries no signature', async () => {
        await expectFailure(new Uint8Array(Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n%%EOF\n', 'latin1')), 'no_signature');
    });

    test('rejects a file larger than the policy allows', async () => {
        await expectFailure(new Uint8Array(FOD_JUSTITIE_SIGNATURE_POLICY.maximumFileSize + 1), 'file_too_large');
    });

    test('names the signer of the policy in what the uploader reads', async () => {
        const thrown = await verifyPdf(new Uint8Array(Buffer.from('This is not a pdf')), FOD_JUSTITIE_SIGNATURE_POLICY, MAXIMUM_AGE_IN_DAYS).then(() => null, (error: unknown) => error);

        expect((thrown as SimpleError).human).toContain(FOD_JUSTITIE_SIGNATURE_POLICY.signerName);
    });
});

/**
 * The whole wrapper over a document that passes, which is the one path the revocation tests cannot
 * reach: they call the lookup directly with a stub, and `verifyPdf` takes no stub — it builds its own
 * client, by design, so the backend entry point has nothing in it that only a test uses.
 *
 * What replaces the stub here is `fetch` itself, the one seam that is left. Nothing goes out: a
 * responder answering for a url not put in the map fails the test rather than reaching the network.
 */
describe('verifyPdf over a document that passes', () => {
    const SIGNER_OCSP_URL = 'http://ocsp.example.com/signer';
    const INTERMEDIATE_OCSP_URL = 'http://ocsp.example.com/intermediate';
    const SIGNED_AT = new Date('2026-11-02T17:02:46Z');
    // After the moment the responses say they were produced, and before they go stale.
    const NOW = new Date('2026-11-04T12:00:00Z');

    let chain: TestChain;
    let bytes: Uint8Array;
    let responses: Map<string, Uint8Array>;

    // Generating RSA keys and signing is the slow part, so the suite builds all of it once.
    beforeAll(async () => {
        chain = await createTestChain({ signerOcspUrl: SIGNER_OCSP_URL, intermediateOcspUrl: INTERMEDIATE_OCSP_URL });
        bytes = await createSignedPdf({ chain, signedAt: SIGNED_AT });

        // One response per certificate the chain walk asks about: the signer, then the intermediate.
        // The anchor is pinned by the hash of its public key, so there is nothing to ask about it.
        responses = new Map([
            [SIGNER_OCSP_URL, await createOcspResponse({ certificate: chain.signer.certificate, issuer: chain.intermediate, status: 'good' })],
            [INTERMEDIATE_OCSP_URL, await createOcspResponse({ certificate: chain.intermediate.certificate, issuer: chain.anchor, status: 'good' })],
        ]);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    /** Answers out of the map, and records what was asked. */
    function stubFetch(): string[] {
        const asked: string[] = [];

        vi.stubGlobal('fetch', (url: string) => {
            asked.push(url);
            const response = responses.get(url);

            if (response === undefined) {
                throw new Error(`Nothing was put in the stub for ${url}`);
            }

            return Promise.resolve(new Response(response.slice().buffer as ArrayBuffer, { status: 200 }));
        });

        return asked;
    }

    function setNow(date: Date) {
        vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] }).setSystemTime(date);
    }

    test('answers with the signing time out of the signature', async () => {
        const asked = stubFetch();
        setNow(NOW);

        // The date the signer put its name to, through both halves of the verification: this is what
        // a caller stores next to a file it accepted.
        await expect(verifyPdf(bytes, chain.policy, MAXIMUM_AGE_IN_DAYS)).resolves.toEqual(SIGNED_AT);

        // And it really did go through the revocation lookup to get there.
        expect(asked).toEqual([SIGNER_OCSP_URL, INTERMEDIATE_OCSP_URL]);
    });

    test('rejects the same document when a certificate behind it was revoked', async () => {
        stubFetch();
        responses.set(SIGNER_OCSP_URL, await createOcspResponse({ certificate: chain.signer.certificate, issuer: chain.intermediate, status: 'revoked' }));
        setNow(NOW);

        const thrown = await verifyPdf(bytes, chain.policy, MAXIMUM_AGE_IN_DAYS).then(() => null, (error: unknown) => error);

        expect(isSimpleError(thrown)).toBe(true);
        expect((thrown as SimpleError).code).toBe('certificate_revoked');

        responses.set(SIGNER_OCSP_URL, await createOcspResponse({ certificate: chain.signer.certificate, issuer: chain.intermediate, status: 'good' }));
    });
});
