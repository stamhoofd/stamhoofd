import { AutoEncoder, field, ObjectData, StringDecoder } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';
import { describe, expect, it } from 'vitest';

import { TranslatedLongText } from './TranslatedLongText.js';
import { TranslatedPlainTextPatch } from './TranslatedPlainText.js';
import { TranslatedString, TranslatedStringPatch } from './TranslatedString.js';
import { TranslatedText } from './TranslatedText.js';

class ShortStruct extends AutoEncoder {
    @field({ decoder: StringDecoder })
    @field(TranslatedText.field({ version: 426 }))
    name = TranslatedText.create();
}

class LongStruct extends AutoEncoder {
    @field(TranslatedString.field({ version: 370 }))
    @field(TranslatedLongText.field({ version: 426 }))
    description = TranslatedLongText.create();
}

describe('TranslatedText and TranslatedLongText', () => {
    it('keeps the type of the value when patching and cloning', () => {
        const text = TranslatedText.create({ [Language.Dutch]: 'Naam' });
        expect(text.patch({ [Language.French]: 'Nom' })).toBeInstanceOf(TranslatedText);
        expect(text.clone()).toBeInstanceOf(TranslatedText);

        const long = TranslatedLongText.create('Beschrijving');
        expect(long.patch('Andere')).toBeInstanceOf(TranslatedLongText);
        expect(long.clone()).toBeInstanceOf(TranslatedLongText);
    });

    it('turns a line break into a space, because only rich text can contain lines', () => {
        expect(TranslatedText.create('Eerste\nTweede').toString()).toBe('Eerste Tweede');
        expect(TranslatedLongText.create({ [Language.Dutch]: 'Eerste\nTweede' }).get(Language.Dutch)).toBe('Eerste Tweede');
        expect(TranslatedText.create('Naam').patch('Eerste\nTweede').toString()).toBe('Eerste Tweede');
        expect(TranslatedText.create({ [Language.Dutch]: 'Naam' }).patch({ [Language.Dutch]: 'Eerste\nTweede' }).get(Language.Dutch)).toBe('Eerste Tweede');
    });

    it('encodes exactly like a TranslatedString, so a converted field keeps its wire format', () => {
        const cases: (string | { [key in Language]?: string })[] = [
            'Naam',
            { [Language.Dutch]: 'Naam' },
            { [Language.Dutch]: 'Naam', [Language.French]: 'Nom' },
        ];

        for (const translations of cases) {
            expect(TranslatedText.create(translations).encode({ version: 426 }))
                .toEqual(TranslatedString.create(translations).encode({ version: 426 }));
        }
    });

    it('decodes a plain string that was stored before the field was translatable', () => {
        const decoded = new ObjectData({ name: 'Naam' }, { version: 426 }).decode(ShortStruct);
        expect(decoded.name).toBeInstanceOf(TranslatedText);
        expect(decoded.name.isDefault).toBe(true);
        expect(decoded.name.toString()).toBe('Naam');
    });

    it('decodes a stored language map', () => {
        const decoded = new ObjectData({ name: { [Language.Dutch]: 'Naam', [Language.French]: 'Nom' } }, { version: 426 }).decode(ShortStruct);
        expect(decoded.name.get(Language.French)).toBe('Nom');
    });

    it('upgrades a plain string field of an older client', () => {
        const decoded = new ObjectData({ name: 'Naam' }, { version: 425 }).decode(ShortStruct);
        expect(decoded.name).toBeInstanceOf(TranslatedText);
        expect(decoded.name.toString()).toBe('Naam');
    });

    it('downgrades to the request language for an older client', () => {
        const struct = ShortStruct.create({ name: TranslatedText.create({ [Language.Dutch]: 'Naam', [Language.French]: 'Nom' }) });
        expect((struct.encode({ version: 425 }) as Record<string, unknown>).name).toBe('Naam');
    });

    it('upgrades a TranslatedString field of an older client and keeps every language', () => {
        const encoded = { description: { [Language.Dutch]: 'Beschrijving', [Language.French]: 'Description' } };
        const decoded = new ObjectData(encoded, { version: 425 }).decode(LongStruct);

        expect(decoded.description).toBeInstanceOf(TranslatedLongText);
        expect(decoded.description.get(Language.Dutch)).toBe('Beschrijving');
        expect(decoded.description.get(Language.French)).toBe('Description');
    });

    it('only changes the patched language for a language patch of an older client', () => {
        const struct = LongStruct.create({
            description: TranslatedLongText.create({ [Language.Dutch]: 'Beschrijving', [Language.French]: 'Description' }),
        });

        const encoded = { description: new TranslatedStringPatch({ [Language.Dutch]: 'Nieuw' }).encode({ version: 425 }) };
        const patched = struct.patch(new ObjectData(encoded, { version: 425 }).decode(LongStruct.patchType()));

        expect(patched.description.get(Language.Dutch)).toBe('Nieuw');
        expect(patched.description.get(Language.French)).toBe('Description');
    });

    it('encodes and decodes a language patch', () => {
        const struct = ShortStruct.create({ name: TranslatedText.create({ [Language.Dutch]: 'Naam', [Language.French]: 'Nom' }) });
        const patch = ShortStruct.patch({ name: new TranslatedPlainTextPatch({ [Language.French]: null }) });

        const decoded = new ObjectData(patch.encode({ version: 426 }), { version: 426 }).decode(ShortStruct.patchType());
        expect(struct.patch(decoded).name.languages).toEqual([Language.Dutch]);
    });

    it('downgrades a language patch to a plain string for an older client', () => {
        const patch = ShortStruct.patch({ name: new TranslatedPlainTextPatch({ [Language.Dutch]: 'Naam' }) });
        expect((patch.encode({ version: 425 }) as Record<string, unknown>).name).toBe('Naam');
    });
});
