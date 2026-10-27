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

    it('recognizes structured errors without accepting ordinary errors', () => {
        expect(isSimpleError(new SimpleError({ code: 'invalid', message: 'Invalid value' }))).toBe(true);
        expect(isSimpleError(null)).toBe(false);
        expect(isSimpleError(new Error('ordinary error'))).toBe(false);
    });

});
