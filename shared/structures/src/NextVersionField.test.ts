import { AutoEncoder, field, ObjectData, StringDecoder } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';
import { TranslatedString } from './TranslatedString.js';
import { Version } from './Version.js';

class SpreadForm extends AutoEncoder {
    @field({ decoder: StringDecoder })
    @field({ ...TranslatedString.field({}), ...NextVersion })
    name = new TranslatedString();
}

class HelperCallForm extends AutoEncoder {
    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ ...NextVersion }))
    name = new TranslatedString();
}

describe.each([
    ['@field({ ...TranslatedString.field({}), ...NextVersion })', SpreadForm],
    ['@field(TranslatedString.field({ ...NextVersion }))', HelperCallForm],
])('...NextVersion with upgrade and downgrade: %s', (_, Struct) => {
    const translations = { [Language.Dutch]: 'Hallo', [Language.French]: 'Bonjour' };

    it('downgrades to the old type when encoding for the previous version', () => {
        const struct = Struct.create({ name: new TranslatedString(translations) });

        const encoded = struct.encode({ version: Version - 1 }) as Record<string, unknown>;
        expect(typeof encoded.name).toBe('string');
        expect(encoded.name).toBe(new TranslatedString(translations).toString());
    });

    it('keeps the new type when encoding for the current version', () => {
        const struct = Struct.create({ name: new TranslatedString(translations) });

        const encoded = struct.encode({ version: Version }) as Record<string, unknown>;
        expect(encoded.name).toEqual(translations);
    });

    it('upgrades data of the previous version', () => {
        const decoded = Struct.decode(new ObjectData({ name: 'Hallo' }, { version: Version - 1 }));

        expect(decoded.name).toBeInstanceOf(TranslatedString);
        expect(decoded.name.translations).toBe('Hallo');
    });

    it('decodes data of the current version', () => {
        const decoded = Struct.decode(new ObjectData({ name: translations }, { version: Version }));

        expect(decoded.name).toBeInstanceOf(TranslatedString);
        expect(decoded.name.translations).toEqual(translations);
    });
});
