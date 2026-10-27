import { ObjectData } from '@common/encoding';
import { SGVLidPatch } from './types.js';

describe('SGVLidPatch persoonsgegevens', () => {
    const context = { version: 0 };

    test('retains partial payloads and unknown nested values as plain objects', () => {
        const payload = { persoonsgegevens: { gsm: '123', extension: { nested: [true, null] } } };
        const decoded = SGVLidPatch.decode(new ObjectData(payload, context));
        expect(decoded.persoonsgegevens).toEqual(payload.persoonsgegevens);
        expect(decoded.persoonsgegevens).not.toBe(payload.persoonsgegevens);
        expect(decoded.persoonsgegevens).not.toBeInstanceOf(Map);
        expect(decoded.encode(context)).toEqual(payload);
        const patch = SGVLidPatch.patchType().decode(new ObjectData(payload, context));
        expect(SGVLidPatch.create({ persoonsgegevens: { geslacht: 'M' } }).patch(patch).persoonsgegevens).toEqual(payload.persoonsgegevens);
    });

    test('preserves omission, explicit undefined, empty objects and validation', () => {
        expect(SGVLidPatch.decode(new ObjectData({}, context)).persoonsgegevens).toBeUndefined();
        expect(SGVLidPatch.decode(new ObjectData({ persoonsgegevens: undefined }, context)).persoonsgegevens).toBeUndefined();
        expect(SGVLidPatch.decode(new ObjectData({ persoonsgegevens: {} }, context)).persoonsgegevens).toEqual({});
        expect(() => SGVLidPatch.decode(new ObjectData({ persoonsgegevens: 'invalid' }, context))).toThrow();
        expect(() => SGVLidPatch.decode(new ObjectData({ persoonsgegevens: null }, context))).toThrow();
    });
});
