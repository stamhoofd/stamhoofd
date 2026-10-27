import { ObjectData } from '../classes/ObjectData.js';
import { EnumDecoder } from './EnumDecoder.js';
import { MapDecoder } from './MapDecoder.js';
import StringDecoder from './StringDecoder.js';

enum Keys {
    A = 'A',
    B = 'B',
}

describe('Map dictionary validation', () => {
    test('can decode an object', () => {
        const decoder = new MapDecoder(new EnumDecoder(Keys), StringDecoder);
        const encoded = { A: 'Hello', B: 'World' };
        const decoded = decoder.decode(new ObjectData(encoded, { version: 1 }));
        expect(decoded).toEqual(new Map(Object.entries(encoded)));
    });

    test('throws on invalid keys', () => {
        const decoder = new MapDecoder(new EnumDecoder(Keys), StringDecoder);
        expect(() => decoder.decode(new ObjectData({ C: 'Hello', B: 'World' }, { version: 1 }))).toThrow(/Unknown enum value C/i);
    });

    test('throws on invalid values', () => {
        const decoder = new MapDecoder(new EnumDecoder(Keys), StringDecoder);
        expect(() => decoder.decode(new ObjectData({ A: 10, B: 'World' }, { version: 1 }))).toThrow(/expected a string/i);
    });
});
