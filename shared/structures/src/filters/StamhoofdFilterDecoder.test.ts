import { ObjectData } from '@common/encoding';
import { StamhoofdFilterDecoder } from './StamhoofdFilterDecoder.js';

const context = { version: 1 };

describe('filter dictionary security', () => {
    test('conversion preserves special own keys as ordinary data', () => {
        const input = JSON.parse(
            '{"__proto__":{"value":1},"constructor":"data","prototype":"data"}',
        );
        for (const output of [
            StamhoofdFilterDecoder.encode(input, context),
            StamhoofdFilterDecoder.decode(new ObjectData(input, context)),
        ]) {
            expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
            expect(Object.hasOwn(output as object, '__proto__')).toBe(true);
            expect(output).toEqual(input);
        }
    });

    test('date markers must be own properties', () => {
        for (const input of [
            Object.assign(Object.create({ $: '$date' }), { value: 123 }),
            Object.assign(Object.create({ value: 123 }), { $: '$date' }),
            Object.create({ $: '$date', value: 123 }),
        ]) {
            expect(StamhoofdFilterDecoder.decode(new ObjectData(input, context))).toEqual({
                ...input,
            });
        }
        expect(
            StamhoofdFilterDecoder.decode(new ObjectData({ $: '$date', value: 123 }, context)),
        ).toEqual(new Date(123));
    });

    test('conversion accepts null prototype dictionaries and excludes inherited data', () => {
        for (const input of [
            Object.assign(Object.create(null), { own: true }),
            Object.assign(Object.create({ inherited: true }), { own: true }),
        ]) {
            expect(StamhoofdFilterDecoder.encode(input, context)).toEqual({ own: true });
            expect(StamhoofdFilterDecoder.decode(new ObjectData(input, context))).toEqual({
                own: true,
            });
        }
    });
});
