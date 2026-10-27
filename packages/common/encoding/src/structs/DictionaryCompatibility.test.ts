import { AutoEncoder } from '../classes/AutoEncoder.js';
import { encodeObject } from '../classes/Encodeable.js';
import { EncodeMedium } from '../classes/EncodeContext.js';
import { ObjectData } from '../classes/ObjectData.js';
import { PatchMap } from '../classes/Patchable.js';
import { field } from '../decorators/Field.js';
import { deepSet } from '../helpers/deepSet.js';
import IntegerDecoder from './IntegerDecoder.js';
import { MapDecoder } from './MapDecoder.js';
import { PatchOrPutDecoder } from './PatchOrPutDecoder.js';
import StringDecoder from './StringDecoder.js';

class MapDictionary extends AutoEncoder {
    @field({
        decoder: new MapDecoder(StringDecoder, StringDecoder),
        optional: true,
        defaultValue: () => new Map<string, string>(),
        isDefaultValue: () => false,
    })
    values = new Map<string, string>();
}

class NullableMapDictionary extends AutoEncoder {
    @field({ decoder: new MapDecoder(StringDecoder, StringDecoder), version: 209, nullable: true })
    values: Map<string, string> | null = null;
}

describe('Record to Map compatibility', () => {
    for (const medium of [EncodeMedium.Network, EncodeMedium.Database]) {
        const context = { version: 500, medium };
        const json = (value: AutoEncoder) => JSON.stringify(value.encode(context));

        describe(`${medium} encoding`, () => {
            test.each([{}, { values: undefined }, { values: {} }, { values: { z: 'last', a: 'first', 42: 'numeric' } }])('preserves historical full-value JSON: %j', (payload) => {
                const newValue = MapDictionary.decode(new ObjectData(payload, context));
                expect(newValue.values).toEqual(new Map(Object.entries(payload.values ?? {})));
                expect(JSON.parse(json(newValue))).toEqual({ values: payload.values ?? {} });
            });

            test('creates independent defaults and ignores explicit undefined', () => {
                const first = MapDictionary.create({ values: undefined });
                const second = MapDictionary.create({});
                expect(first.values).toEqual(new Map());
                expect(first.values).not.toBe(second.values);
                expect(JSON.parse(json(first))).toEqual({ values: {} });
            });

            test.each([{}, { values: undefined }, { values: {} }, { values: { a: 'updated' } }, { values: { _isPatch: 'dictionary value' } }, { values: { _isPatch: 'true', changes: 'dictionary value' } }])('preserves historical replacement patches: %j', (payload) => {
                const original = { a: 'old', b: 'retained only without replacement' };
                const newValue = MapDictionary.create({ values: new Map(Object.entries(original)) });
                const newPatch = MapDictionary.patchType().decode(new ObjectData(payload, context));
                expect(JSON.parse(json(newValue.patch(newPatch)))).toEqual({ values: payload.values ?? original });
                expect(JSON.parse(json(newPatch))).toEqual(payload.values === undefined ? { _isPatch: true } : { _isPatch: true, values: payload.values });
            });

            test('accepts a typed full Map replacement, including empty replacements', () => {
                const original = MapDictionary.create({ values: new Map([['old', 'value']]) });
                for (const values of [new Map<string, string>(), new Map([['new', 'value']])]) {
                    const patch = MapDictionary.patch({ values });
                    const decoded = MapDictionary.patchType().decode(new ObjectData(JSON.parse(json(patch)), context));
                    expect(original.patch(decoded).values).toEqual(values);
                    expect(original.values).toEqual(new Map([['old', 'value']]));
                }
            });

            test('round-trips incremental insertion, update, deletion and combination', () => {
                const original = MapDictionary.create({ values: new Map([['update', 'old'], ['delete', 'old'], ['keep', 'original']]) });
                const first = MapDictionary.patch({});
                first.values.set('insert', 'new');
                first.values.set('update', 'updated');
                const second = MapDictionary.patch({});
                second.values.set('delete', null);
                second.values.set('update', 'final');
                const combined = first.patch(second);
                expect(combined.values).toBeInstanceOf(PatchMap);
                const decoded = MapDictionary.patchType().decode(new ObjectData(JSON.parse(json(combined)), context));
                expect(original.patch(decoded).values).toEqual(new Map([['update', 'final'], ['keep', 'original'], ['insert', 'new']]));
                expect(original.values.get('update')).toBe('old');
            });

            test.each([true, 'true', 1])('retains historical incremental discriminator %j', (flag) => {
                const original = MapDictionary.create({ values: new Map([['keep', 'value']]) });
                const patch = MapDictionary.patchType().decode(new ObjectData({ values: { _isPatch: flag, changes: { insert: 'new' } } }, context));
                expect(original.patch(patch).values).toEqual(new Map([['keep', 'value'], ['insert', 'new']]));
                const classDecoder = new PatchOrPutDecoder(MapDictionary, MapDictionary.patchType());
                expect(classDecoder.decode(new ObjectData({ _isPatch: flag }, context)).isPatch()).toBe(true);
                expect(() => classDecoder.decode(new ObjectData({ _isPatch: 'invalid' }, context))).toThrow('Expected a boolean');
            });

            test.each([208, 209, 500])('preserves nullable values and historical version %i', (version) => {
                const versionContext = { ...context, version };
                for (const payload of [{}, { values: undefined }, { values: null }, { values: {} }, { values: { header: 'value' } }]) {
                    const newValue = NullableMapDictionary.decode(new ObjectData(payload, versionContext));
                    const expected = version < 209 || payload.values == null ? null : new Map(Object.entries(payload.values));
                    const encoded = expected === null ? {} : { values: payload.values };
                    expect(newValue.values).toEqual(expected);
                    expect(newValue.encode(versionContext)).toEqual(encoded);
                    const newPatch = NullableMapDictionary.patchType().decode(new ObjectData(payload, versionContext));
                    expect(newValue.patch(newPatch).encode(versionContext)).toEqual(encoded);
                }
            });
        });
    }

    test('numeric keys preserve their JSON representation', () => {
        const context = { version: 500, medium: EncodeMedium.Database };
        const payload = { 10: 'ten', 2: 'two' };
        const map = new MapDecoder(IntegerDecoder, StringDecoder).decode(new ObjectData(payload, context));
        expect(map.get(2)).toBe('two');
        expect(JSON.stringify(encodeObject(map, context))).toBe(JSON.stringify(payload));
        expect(() => encodeObject(new Map<string | number, string>([[2, 'number'], ['2', 'string']]), context)).toThrow('Map keys must be of the same type');
    });

    test('clones Maps and preserves existing references during deepSet', () => {
        const original = MapDictionary.create({ values: new Map([['old', 'value']]) });
        const cloned = original.clone();
        expect(cloned.values).toEqual(original.values);
        expect(cloned.values).not.toBe(original.values);
        const reference = original.values;
        const replacement = MapDictionary.create({ values: new Map([['new', 'value']]) });
        deepSet(original, replacement);
        expect(original.values).toBe(reference);
        expect(original.values).toEqual(new Map([['new', 'value']]));
        expect(replacement.values).toBe(reference);
    });
});
