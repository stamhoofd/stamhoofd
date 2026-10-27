import { ObjectData } from '@common/encoding';
import { SGVPartialObjectDecoder } from './SGVPartialObjectDecoder.js';
import { SGVLidPatch } from './types.js';

const context = { version: 0 };

function expectNullPrototypeObjects(value: unknown) {
    if (Array.isArray(value)) {
        for (const item of value) {
            expectNullPrototypeObjects(item);
        }
    } else if (value !== null && typeof value === 'object') {
        expect(Object.getPrototypeOf(value)).toBeNull();
        for (const item of Object.values(value)) {
            expectNullPrototypeObjects(item);
        }
    }
}

describe('SGV partial object prototype isolation', () => {
    test('copies only own entries recursively without inherited dictionary properties', () => {
        const nested = Object.assign(Object.create({ inherited: true }), { own: 'value' });
        const payload = Object.assign(Object.create({ inherited: true }), { nested, list: [nested, false, null, 42, 'text'] });
        const decoded = new SGVPartialObjectDecoder<Record<string, unknown>>().decode(new ObjectData(payload, context));

        expectNullPrototypeObjects(decoded);
        expect(decoded.inherited).toBeUndefined();
        expect(decoded.constructor).toBeUndefined();
        expect(decoded.toString).toBeUndefined();
        expect(decoded.nested).not.toBe(nested);
        expect(decoded.list).not.toBe(payload.list);
        expect(JSON.stringify(decoded)).toBe('{"nested":{"own":"value"},"list":[{"own":"value"},false,null,42,"text"]}');
    });

    test.each(['persoonsgegevens', 'vgagegevens', 'verbondsgegevens'] as const)('%s preserves literal special keys through decoding, cloning, patching and JSON encoding', (field) => {
        const value = JSON.parse('{"__proto__":{"sgvPolluted":true},"constructor":{"prototype":{"sgvPolluted":true}},"extension":{"items":[{"__proto__":"literal"},null,false]}}');
        const payload = { [field]: value };
        const decoded = SGVLidPatch.decode(new ObjectData(payload, context));

        expectNullPrototypeObjects(decoded[field]);
        expectNullPrototypeObjects(decoded.clone()[field]);
        expect(Object.hasOwn(decoded[field]!, '__proto__')).toBe(true);
        expect(JSON.stringify(decoded.encode(context))).toBe(JSON.stringify(payload));

        const patch = SGVLidPatch.patchType().decode(new ObjectData(payload, context));
        const patched = SGVLidPatch.create({}).patch(patch);
        expectNullPrototypeObjects(patched[field]);
        expect(JSON.stringify(patched.encode(context))).toBe(JSON.stringify(payload));
        expect(Object.hasOwn(Object.prototype, 'sgvPolluted')).toBe(false);
    });
});
