import { isSimpleError } from '@common/errors';
import type { SimpleError } from '@common/errors';
import { describe, expect, test } from 'vitest';

import { verifyPdfFromFodJustitie } from '../src/FodJustitie.js';

const MAXIMUM_AGE_IN_DAYS = 31;

describe('verifyPdfFromFodJustitie', () => {
    async function expectFailure(bytes: Uint8Array, code: string) {
        const thrown = await verifyPdfFromFodJustitie(bytes, MAXIMUM_AGE_IN_DAYS).then(() => null, (error: unknown) => error);

        expect(isSimpleError(thrown)).toBe(true);
        expect((thrown as SimpleError).code).toBe(code);

        return thrown as SimpleError;
    }

    test('rejects a file that is not a pdf, naming FOD Justitie', async () => {
        const error = await expectFailure(new Uint8Array(Buffer.from('This is not a pdf')), 'not_a_pdf');

        expect(error.human).toContain('FOD Justitie');
    });
});
