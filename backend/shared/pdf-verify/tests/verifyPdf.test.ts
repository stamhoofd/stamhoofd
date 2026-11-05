import { isSimpleError } from '@common/errors';
import type { SimpleError } from '@common/errors';
import { describe, expect, test } from 'vitest';

import { FOD_JUSTITIE_SIGNATURE_POLICY } from '@stamhoofd/pdf-verify-core';
import { verifyPdf } from '../src/verifyPdf.js';

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
