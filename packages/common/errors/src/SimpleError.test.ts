import { NumberDecoder, ObjectData } from '@simonbackx/simple-encoding';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isSimpleError, SimpleError } from './SimpleError.js';

describe('SimpleError', () => {
    it('preserves the serialized error contract', () => {
        const data = {
            id: 'error-id',
            code: 'invalid_email',
            message: 'Invalid email',
            human: 'Ongeldig e-mailadres',
            field: 'email',
            meta: { attempt: 2 },
        };
        const error = new SimpleError({ ...data, statusCode: 422 });

        expect(error).toBeInstanceOf(Error);
        expect(Object.prototype.propertyIsEnumerable.call(error, 'message')).toBe(false);
        expect(error.encode({ version: 0 })).toEqual(data);
        expect(JSON.parse(JSON.stringify(error))).toEqual(data);
        expect(SimpleError.decode(new ObjectData(data, { version: 0 })).encode({ version: 0 })).toEqual(data);
        expect(error.statusCode).toBe(422);
    });

    it('preserves generated IDs, field namespaces, and human-readable messages', () => {
        const error = new SimpleError({ code: 'invalid', message: 'Invalid value', field: 'email' });
        error.addNamespace('member');

        expect(error.id).toMatch(/^[0-9a-f-]{36}@\d+$/);
        expect(error.doesMatchField('member')).toBe(true);
        expect(error.doesMatchFields(['other', 'member.email'])).toBe(true);
        expect(error.getHuman()).toBe('Invalid value');
        expect(error.toString()).toContain('invalid: Invalid value at member.email');
    });

    it('recognizes errors thrown by the unmigrated encoding library', () => {
        let caught: unknown;
        try {
            NumberDecoder.decode(new ObjectData('invalid', { version: 0 }));
        } catch (error) {
            caught = error;
        }

        expect(isSimpleError(caught)).toBe(true);
        expect(isSimpleError(null)).toBe(false);
        expect(isSimpleError(new Error('ordinary error'))).toBe(false);
    });

    it('redirects the encoding library’s legacy error dependency to this workspace', () => {
        const require = createRequire(import.meta.url);
        const encodingRequire = createRequire(require.resolve('@simonbackx/simple-encoding'));

        expect(encodingRequire.resolve('@simonbackx/simple-errors')).toBe(fileURLToPath(new URL('../dist/index.js', import.meta.url)));
    });
});
