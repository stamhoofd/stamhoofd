import { ObjectData } from '@simonbackx/simple-encoding';
import { describe, expect, it } from 'vitest';
import { SimpleError } from './SimpleError.js';
import { isSimpleErrors, SimpleErrors } from './SimpleErrors.js';

describe('SimpleErrors', () => {
    it('round-trips grouped errors and preserves lookup and status behavior', () => {
        const first = new SimpleError({ id: 'first', code: 'first', message: 'First', field: 'name' });
        const second = new SimpleError({ id: 'second', code: 'second', message: 'Second', human: 'Tweede fout', statusCode: 422 });
        const errors = new SimpleErrors(first, second);

        expect(errors.statusCode).toBe(422);
        expect(errors.getCode('second')).toBe(second);
        expect(errors.getHuman()).toBe('First\nTweede fout');
        expect(SimpleErrors.decode(new ObjectData(errors.encode({ version: 0 }), { version: 0 })).encode({ version: 0 })).toEqual(errors.encode({ version: 0 }));
        expect(isSimpleErrors(errors)).toBe(true);
        expect(isSimpleErrors({ errors: [] })).toBe(false);

        errors.addNamespace('member');
        expect(first.field).toBe('member.name');
        expect(errors.hasFieldThatStartsWith('member')).toBe(true);
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
