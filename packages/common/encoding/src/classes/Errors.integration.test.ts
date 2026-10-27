import { isSimpleError, SimpleError, SimpleErrors } from '@common/errors';
import { describe, expect, it } from 'vitest';
import NumberDecoder from '../structs/NumberDecoder.js';
import { ObjectData } from './ObjectData.js';

describe('error encoding compatibility', () => {
    it('round-trips single and grouped errors through ObjectData', () => {
        const error = new SimpleError({ id: 'test', code: 'invalid', message: 'Invalid', meta: { attempt: 2 } });
        const errors = new SimpleErrors(error);

        expect(SimpleError.decode(new ObjectData(error.encode({ version: 0 }), { version: 0 })).encode({ version: 0 })).toEqual(error.encode({ version: 0 }));
        expect(SimpleErrors.decode(new ObjectData(errors.encode({ version: 0 }), { version: 0 })).encode({ version: 0 })).toEqual(errors.encode({ version: 0 }));
    });

    it('throws the shared error implementation for invalid numbers', () => {
        expect(() => NumberDecoder.decode(new ObjectData('invalid', { version: 0 }))).toThrow(SimpleError);
        expect(isSimpleError(new SimpleError({ code: 'invalid', message: 'Invalid' }))).toBe(true);
    });
});
