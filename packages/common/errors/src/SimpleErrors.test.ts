import { describe, expect, it } from 'vitest';
import type { ErrorData, ErrorValue } from './ErrorData.js';
import { SimpleError } from './SimpleError.js';
import { isSimpleErrors, SimpleErrors } from './SimpleErrors.js';

describe('SimpleErrors', () => {
    it('round-trips grouped errors and preserves lookup and status behavior', () => {
        const first = new SimpleError({ id: 'first', code: 'first', message: 'First', field: 'name', meta: { attempt: 2 } });
        const second = new SimpleError({ id: 'second', code: 'second', message: 'Second', human: 'Tweede fout', statusCode: 422 });
        const errors = new SimpleErrors(first, second);

        const decoded = SimpleErrors.decode(createErrorData(errors.encode({ version: 0 })));
        expect(decoded).toBeInstanceOf(SimpleErrors);
        expect(decoded.errors).toHaveLength(2);
        expect(decoded.errors.every(error => error instanceof SimpleError)).toBe(true);
        expect(decoded.encode({ version: 0 })).toEqual(errors.encode({ version: 0 }));

        expect(errors.statusCode).toBe(422);
        expect(errors.getCode('second')).toBe(second);
        expect(errors.getHuman()).toBe('First\nTweede fout');
        expect(isSimpleErrors(errors)).toBe(true);
        expect(isSimpleErrors({ errors: [] })).toBe(false);

        errors.addNamespace('member');
        expect(first.field).toBe('member.name');
        expect(errors.hasFieldThatStartsWith('member')).toBe(true);
    });

    it('decodes an empty error group', () => {
        const decoded = SimpleErrors.decode(createErrorData({ errors: [] }));

        expect(decoded.errors).toEqual([]);
        expect(decoded.encode({ version: 0 })).toEqual({ errors: [] });
    });

    it('throws nothing, one error, or the group according to its size', () => {
        const first = new SimpleError({ code: 'first', message: 'First' });
        const second = new SimpleError({ code: 'second', message: 'Second' });
        const errors = new SimpleErrors();

        expect(() => errors.throwIfNotEmpty()).not.toThrow();
        errors.addError(first);
        expect(() => errors.throwIfNotEmpty()).toThrow(first);
        errors.unshiftError(new SimpleErrors(second));
        expect(errors.errors).toEqual([second, first]);
        expect(() => errors.throwIfNotEmpty()).toThrow(errors);
    });
});

// A valid-data test double for the structural contract, without encoding's validation.
function createErrorData(value: ErrorValue): ErrorData {
    return {
        value,
        string: value as string,
        field(name) {
            return createErrorData((value as Record<string, ErrorValue>)[name]);
        },
        optionalField(name) {
            const field = (value as Record<string, ErrorValue>)[name];
            return field === undefined ? undefined : createErrorData(field);
        },
        array(decoder) {
            return (value as ErrorValue[]).map(item => decoder.decode(createErrorData(item)));
        },
    };
}
