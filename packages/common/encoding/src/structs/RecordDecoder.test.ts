import { ObjectData } from '../classes/ObjectData.js';
import { EnumDecoder } from './EnumDecoder.js';
import { RecordDecoder } from './RecordDecoder.js';
import StringDecoder from './StringDecoder.js';

enum Keys {
    A = 'A',
    B = 'B',
}

describe('RecordDecoder', () => {
    test('can decode an object', () => {
        const decoder = new RecordDecoder(new EnumDecoder(Keys), StringDecoder);

        const encoded = {
            A: 'Hello',
            B: 'World',
        };

        const decoded = decoder.decode(new ObjectData(encoded, { version: 1 }));
        expect(decoded).toEqual(encoded);
    });

    test('throw on invalid key', () => {
        const decoder = new RecordDecoder(new EnumDecoder(Keys), StringDecoder);

        const encoded = {
            C: 'Hello',
            B: 'World',
        };

        expect(() => decoder.decode(new ObjectData(encoded, { version: 1 }))).toThrow(/Unknown enum value C/i);
    });

    test('throw on invalid value', () => {
        const decoder = new RecordDecoder(new EnumDecoder(Keys), StringDecoder);

        const encoded = {
            A: 10,
            B: 'World',
        };

        expect(() => decoder.decode(new ObjectData(encoded, { version: 1 }))).toThrow(/expected a string/i);
    });
});
