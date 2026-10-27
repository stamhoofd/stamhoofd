import { encodeObject } from './Encodeable.js';
import { EncodeMedium } from './EncodeContext.js';

describe('Encodeable', () => {
    it('should encode an object and sort keys alphabetically', () => {
        const obj = {
            z: 1,
            a: 2,
            m: 3,
        };

        const encoded = encodeObject(obj, { version: 1, medium: EncodeMedium.Database });
        expect(JSON.stringify(encoded)).toBe(JSON.stringify({
            a: 2,
            m: 3,
            z: 1,
        }));
    });

    it('should encode a Map and sort keys alphabetically', () => {
        const obj = new Map<string, number>([
            ['z', 1],
            ['a', 2],
            ['m', 3],
        ]);

        const encoded = encodeObject(obj, { version: 1, medium: EncodeMedium.Database });
        expect(JSON.stringify(encoded)).toBe(JSON.stringify({
            a: 2,
            m: 3,
            z: 1,
        }));
    });

    it('should encode a numberic Map and sort keys alphabetically', () => {
        const obj = new Map<number, number>([
            [3, 1],
            [1, 2],
            [2, 3],
        ]);

        const encoded = encodeObject(obj, { version: 1, medium: EncodeMedium.Database });
        expect(JSON.stringify(encoded)).toBe(JSON.stringify({
            1: 2,
            2: 3,
            3: 1,
        }));
    });

    it('should throw when encoding combined maps', () => {
        const obj = new Map<number | string, number>([
            [3, 1],
            [1, 2],
            [2, 3],
            ['a', 3],
        ]);

        expect(() => encodeObject(obj, { version: 1, medium: EncodeMedium.Database })).toThrow('Map keys must be of the same type. Got number and string');
    });

    it('should throw when encoding maps with invalid keys', () => {
        const obj = new Map<any, number>([
            [3, 1],
            [1, 2],
            [2, 3],
            [{}, 3],
        ]);

        expect(() => encodeObject(obj, { version: 1, medium: EncodeMedium.Database })).toThrow('Map keys must be of the same type. Got number and object');
    });

    it('should encode empty maps', () => {
        const obj = new Map<string, number>();

        const encoded = encodeObject(obj, { version: 1, medium: EncodeMedium.Database });
        expect(JSON.stringify(encoded)).toBe(JSON.stringify({}));
    });

    it('should encode arrays', () => {
        const obj = [3, 1, 2];

        const encoded = encodeObject(obj, { version: 1, medium: EncodeMedium.Database });
        expect(JSON.stringify(encoded)).toBe(JSON.stringify([3, 1, 2]));
    });

    it('should call .encode on deep objects in arrays when encoding arrays', () => {
        const obj = [
            {
                encode: () => 'encoded1',
            },
            {
                encode: () => 'encoded2',
            },
        ];

        const encoded = encodeObject(obj, { version: 1, medium: EncodeMedium.Database });
        expect(JSON.stringify(encoded)).toBe(JSON.stringify(['encoded1', 'encoded2']));
    });
});
