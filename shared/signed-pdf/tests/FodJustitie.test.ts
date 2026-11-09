import { isSimpleError } from '@common/errors';
import type { SimpleError } from '@common/errors';
import { describe, expect, test } from 'vitest';

import { verifyPdfFromFodJustitie } from '../src/FodJustitie.js';

describe('verifyPdfFromFodJustitie', () => {
    test('rejects a file that is not a pdf', async () => {
        const thrown = await verifyPdfFromFodJustitie(new Uint8Array([1, 2, 3])).then(() => null, (error: unknown) => error);

        expect(isSimpleError(thrown)).toBe(true);
        expect((thrown as SimpleError).code).toBe('not_a_pdf');

        // The shorthand pins a policy of its own, so it must not leak the name of the one caller it
        // exists for into what the member reads.
        expect((thrown as SimpleError).human).toBeTruthy();
        expect((thrown as SimpleError).human).not.toContain('FOD Justitie');
    });
});
