import { cloneObject } from './classes/Cloneable.js';
import { encodeObject } from './classes/Encodeable.js';
import { EncodeMedium } from './classes/EncodeContext.js';
import { ObjectData } from './classes/ObjectData.js';
import { PatchMap } from './classes/Patchable.js';
import { deepSet } from './helpers/deepSet.js';
import { MapDecoder } from './structs/MapDecoder.js';
import StringDecoder from './structs/StringDecoder.js';

const context = { version: 1 };
const special = () => JSON.parse('{"__proto__":{"polluted":true},"constructor":"data","prototype":"data"}');

describe('dictionary security', () => {
    test('dictionary round trips preserve special own keys without changing the prototype', () => {
        const input = JSON.parse('{"__proto__":"value","constructor":"data","prototype":"data"}');
        const decoded = new MapDecoder(StringDecoder, StringDecoder).decode(new ObjectData(input, context));
        const output = encodeObject(decoded, context) as object;
        expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
        expect(Object.keys(output)).toEqual(Object.keys(input));
        expect(Object.getOwnPropertyDescriptor(output, '__proto__')?.value).toBe('value');
    });

    test('decoders ignore inherited enumerable entries and accept null prototypes', () => {
        const decoder = new MapDecoder(StringDecoder, StringDecoder);
        for (const input of [Object.assign(Object.create({ inherited: 'ignored' }), { own: 'value' }), Object.assign(Object.create(null), { own: 'value' })]) {
            expect([...decoder.decode(new ObjectData(input, context))]).toEqual([['own', 'value']]);
            expect([...decoder.patchType().decode(new ObjectData({ changes: input }, context))]).toEqual([['own', 'value']]);
        }
    });

    test.each([undefined, EncodeMedium.Network, EncodeMedium.Database])('encoding safely preserves keys for medium %s', (medium) => {
        const input = special();
        for (const value of [input, new Map(Object.entries(input))]) {
            const output = encodeObject(value, { ...context, medium });
            expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
            expect(Object.hasOwn(output as object, '__proto__')).toBe(true);
            expect(output).toEqual(input);
        }
        const patch = encodeObject(new PatchMap(Object.entries(input)), { ...context, medium }) as any;
        expect(patch._isPatch).toBe(true);
        expect(Object.hasOwn(patch.changes, '__proto__')).toBe(true);
        expect(patch.changes).toEqual(input);
    });

    test('network encoding ignores inherited entries', () => {
        expect(encodeObject(Object.assign(Object.create({ inherited: 1 }), { own: 2 }), context)).toEqual({ own: 2 });
    });

    test('database encoding retains dictionary and map sorting with special keys', () => {
        const input = { z: 1, ...special(), id: 'id', name: 'name', description: 'description', a: undefined };
        const output = encodeObject(input, { ...context, medium: EncodeMedium.Database }) as object;
        expect(Object.keys(output)).toEqual(['id', 'name', 'description', '__proto__', 'a', 'constructor', 'prototype', 'z']);
        const map = new Map([['z', 1], ['__proto__', 2], ['a', 3]]);
        const encodedMap = encodeObject(map, { ...context, medium: EncodeMedium.Database }) as object;
        expect(Object.keys(encodedMap)).toEqual(['__proto__', 'a', 'z']);
        const dictionary = Object.assign(Object.create(null), input);
        expect(encodeObject(dictionary, context)).toEqual(input);
    });

    test('map and patch-map round trips retain special keys and deletion semantics', () => {
        const decoder = new MapDecoder(StringDecoder, StringDecoder);
        const map = new Map([['__proto__', 'before'], ['constructor', 'keep'], ['prototype', 'remove']]);
        expect(decoder.decode(new ObjectData(encodeObject(map, context), context))).toEqual(map);
        const patch = new PatchMap<string, string | null>([['__proto__', 'after'], ['prototype', null]]);
        const encoded = encodeObject(patch, context);
        const decoded = decoder.patchType().decode(new ObjectData(encoded, context));
        expect([...decoded]).toEqual([...patch]);
        expect([...decoded.applyTo(map)]).toEqual([['__proto__', 'after'], ['constructor', 'keep']]);
        expect([...new PatchMap([['constructor', undefined]]).applyTo(map)]).toEqual([...map]);
        expect(map.get('__proto__')).toBe('before');
    });

    test('deepSet does not traverse inherited values and synchronizes the source reference', () => {
        const inherited = { value: 'unchanged' };
        const base = Object.create({ nested: inherited });
        const source = { nested: { value: 'new' } };
        expect(deepSet(base, source)).toBe(base);
        expect(inherited.value).toBe('unchanged');
        expect(Object.hasOwn(base, 'nested')).toBe(true);
        expect(source.nested).toBe(base.nested);
    });

    test('deepSet preserves special keys as data and removes obsolete dictionary keys', () => {
        const base = { obsolete: true, keep: { value: 1 } } as any;
        const keep = base.keep;
        const source = { ...special(), keep: { value: 2 }, explicit: undefined };
        deepSet(base, source);
        expect(Object.getPrototypeOf(base)).toBe(Object.prototype);
        expect(Object.hasOwn(base, '__proto__')).toBe(true);
        expect(Object.hasOwn(base, 'obsolete')).toBe(false);
        expect(Object.hasOwn(base, 'explicit')).toBe(true);
        expect(base.keep).toBe(keep);
        expect(source.keep).toBe(keep);
    });

    test('deepSet invokes class setters without recursing into inherited getters', () => {
        const inherited = { value: 'unchanged' };
        class Model {
            stored: unknown;
            get nested() { return inherited; }
            set nested(value: unknown) { this.stored = value; }
        }
        const base = new Model();
        const source = { nested: { value: 'new' } };
        deepSet(base, source);
        expect(inherited.value).toBe('unchanged');
        expect(base.stored).toBe(source.nested);
        expect(Object.hasOwn(base, 'nested')).toBe(false);
    });

    test('deepSet retains own container identities for null prototype input', () => {
        const nested = { value: 1 };
        const array = [1];
        const map = new Map([['__proto__', { value: 1 }]]);
        const base = { nested, array, map };
        const source = Object.assign(Object.create(null), { nested: { value: 2 }, array: [2], map: new Map([['__proto__', { value: 2 }]]) });
        deepSet(base, source);
        expect(base.nested).toBe(nested);
        expect(source.nested).toBe(nested);
        expect(base.array).toBe(array);
        expect(source.array).toBe(array);
        expect(base.map).toBe(map);
        expect(source.map).toBe(map);
        expect(map.get('__proto__')).toEqual({ value: 2 });
    });

    test('cloning uses the actual prototype, not a constructor property', () => {
        const input = { ...special(), nested: { value: true }, clone: 'data' };
        const output = cloneObject(input);
        expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
        expect(Object.getOwnPropertyDescriptor(output, '__proto__')?.value).toBe(input.__proto__);
        expect(output.nested).toBe(input.nested);
        expect(output).toEqual(input);
    });

    test('cloning null prototype dictionaries preserves their prototype and shallow values', () => {
        const input = Object.assign(Object.create(null), { nested: {}, constructor: null });
        const output = cloneObject(input);
        expect(Object.getPrototypeOf(output)).toBe(null);
        expect(output.nested).toBe(input.nested);
        expect(output).not.toBe(input);
    });

    test('cloning does not consult an own constructor getter', () => {
        const input = { nested: {} };
        Object.defineProperty(input, 'constructor', { get() {
            throw new Error('not a prototype source');
        } });
        const output = cloneObject(input);
        expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
        expect(output.nested).toBe(input.nested);
    });
});
