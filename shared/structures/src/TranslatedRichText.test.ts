import { AutoEncoder, field, ObjectData } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';

import { RichText } from './RichText.js';
import { TranslatedRichText, TranslatedRichTextDecoder, TranslatedRichTextPatch } from './TranslatedRichText.js';

const dutch = RichText.create({ html: '<p>Hallo</p>', text: 'Hallo' });
const french = RichText.create({ html: '<p>Bonjour</p>', text: 'Bonjour' });
const english = RichText.create({ html: '<p>Hello</p>', text: 'Hello' });

describe('TranslatedRichText', () => {
    it('encodes an untranslated value as a plain RichText', () => {
        const value = TranslatedRichText.create(dutch);
        const encoded = value.encode({ version: 426 });
        expect(encoded).toEqual(dutch.encode({ version: 426 }));

        const decoded = new ObjectData(encoded, { version: 426 }).decode(TranslatedRichTextDecoder);
        expect(decoded.isDefault).toBe(true);
        expect(decoded.html).toBe('<p>Hallo</p>');
    });

    it('keeps the language of a value with a single translation', () => {
        const value = TranslatedRichText.create({ [Language.French]: french });
        const decoded = new ObjectData(value.encode({ version: 426 }), { version: 426 }).decode(TranslatedRichTextDecoder);
        expect(decoded.isDefault).toBe(false);
        expect(decoded.languages).toEqual([Language.French]);

        // A later language patch keeps the existing translation
        const patched = decoded.patch({ [Language.Dutch]: dutch });
        expect(patched.get(Language.French).text).toBe('Bonjour');
        expect(patched.get(Language.Dutch).text).toBe('Hallo');
    });

    it('ignores languages with an undefined value', () => {
        const value = TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: undefined });
        expect(value.languages).toEqual([Language.Dutch]);
        expect(value.clone().languages).toEqual([Language.Dutch]);
        expect(value.transformForDiff().get(Language.Dutch)).toBe('Hallo');
        expect(Object.keys(value.encode({ version: 426 }) as object)).toEqual([Language.Dutch]);
    });

    it('encodes and decodes multiple languages', () => {
        const value = TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french });
        const encoded = value.encode({ version: 426 });

        const decoded = new ObjectData(encoded, { version: 426 }).decode(TranslatedRichTextDecoder);
        expect(decoded.isDefault).toBe(false);
        expect(decoded.languages).toEqual([Language.Dutch, Language.French]);
        expect(decoded.get(Language.Dutch).html).toBe('<p>Hallo</p>');
        expect(decoded.get(Language.French).html).toBe('<p>Bonjour</p>');
    });

    it('rejects unknown language keys', () => {
        expect(() => new ObjectData({ xx: dutch.encode({ version: 426 }) }, { version: 426 }).decode(TranslatedRichTextDecoder)).toThrow();
    });

    it('falls back to another language when the requested one is missing', () => {
        const value = TranslatedRichText.create({ [Language.Dutch]: dutch });
        expect(value.getIfExists(Language.French)).toBeNull();
        expect(value.get(Language.French).text).toBe('Hallo');
    });

    it('patches a single language and removes languages with null', () => {
        const value = TranslatedRichText.create({ [Language.Dutch]: dutch });

        const added = value.patch({ [Language.French]: french });
        expect(added.languages).toEqual([Language.Dutch, Language.French]);

        const removed = added.patch({ [Language.Dutch]: null });
        expect(removed.languages).toEqual([Language.French]);

        // Original is not modified
        expect(value.languages).toEqual([Language.Dutch]);
    });

    it('merges patches of different languages', () => {
        const merged = new TranslatedRichTextPatch({ [Language.Dutch]: dutch })
            .patch(new TranslatedRichTextPatch({ [Language.French]: null }));

        const value = TranslatedRichText.create({ [Language.French]: french, [Language.English]: english });
        const patched = value.patch(merged);
        expect(patched.languages.sort()).toEqual([Language.English, Language.Dutch].sort());
        expect(patched.get(Language.Dutch).text).toBe('Hallo');
    });

    it('creates a patch that only contains the changed languages', () => {
        const from = TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french });
        const to = TranslatedRichText.create({ [Language.Dutch]: RichText.create({ html: '<p>Dag</p>', text: 'Dag' }), [Language.English]: english });

        const patch = TranslatedRichText.createPatch(from, to);
        expect(patch).toBeInstanceOf(TranslatedRichTextPatch);
        expect((patch as TranslatedRichTextPatch).translations).toEqual({
            [Language.Dutch]: to.get(Language.Dutch),
            [Language.English]: english,
            [Language.French]: null,
        });

        // Unchanged languages edited concurrently by someone else are kept
        const concurrent = from.patch({ [Language.French]: RichText.create({ html: '<p>Salut</p>', text: 'Salut' }) });
        expect(concurrent.patch(TranslatedRichText.createPatch(from, from.patch({ [Language.Dutch]: english }))).get(Language.French).text).toBe('Salut');
    });

    it('creates a full replacement when switching between untranslated and translated content', () => {
        const untranslated = TranslatedRichText.create(dutch);
        const translated = TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french });

        expect(TranslatedRichText.createPatch(untranslated, translated)).toBe(translated);
        expect(TranslatedRichText.createPatch(translated, untranslated)).toBe(untranslated);
    });

    it('replaces the value when patched with a RichText', () => {
        const value = TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french });
        const patched = value.patch(RichText.create({ html: '<p>Nieuw</p>', text: 'Nieuw' }));
        expect(patched.isDefault).toBe(true);
        expect(patched.text).toBe('Nieuw');
    });

    it('becomes untranslated when the last language is removed', () => {
        const value = TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french });

        // Two users each remove a different language
        const patched = value.patch({ [Language.Dutch]: null, [Language.French]: null });
        expect(patched.isDefault).toBe(true);
        expect(patched.text).toBe('');

        // Removing a language from an untranslated value changes nothing
        const untranslated = TranslatedRichText.create(dutch);
        expect(untranslated.patch({ [Language.French]: null })).toBe(untranslated);
    });

    it('decodes an empty language map as an untranslated value', () => {
        const decoded = new ObjectData({}, { version: 426 }).decode(TranslatedRichTextDecoder);
        expect(decoded.isDefault).toBe(true);
        expect(decoded.text).toBe('');
    });
});

class TestStruct extends AutoEncoder {
    @field({ decoder: RichText })
    @field(TranslatedRichText.field({ version: 426 }))
    description = TranslatedRichText.create();

    @field({ decoder: RichText, nullable: true })
    @field(TranslatedRichText.field({ version: 426, nullable: true }))
    optionalDescription: TranslatedRichText | null = null;
}

describe('TranslatedRichText.field', () => {
    it('upgrades a RichText from an older version', () => {
        const encoded = TestStruct.create({}).encode({ version: 425 }) as Record<string, unknown>;
        encoded.description = dutch.encode({ version: 425 });

        const decoded = new ObjectData(encoded, { version: 425 }).decode(TestStruct);
        expect(decoded.description).toBeInstanceOf(TranslatedRichText);
        expect(decoded.description.isDefault).toBe(true);
        expect(decoded.description.html).toBe('<p>Hallo</p>');
        expect(decoded.optionalDescription).toBeNull();
    });

    it('downgrades to a RichText for older clients', () => {
        const struct = TestStruct.create({
            description: TranslatedRichText.create({ [Language.French]: french, [Language.English]: english }),
        });
        const encoded = struct.encode({ version: 425 }) as Record<string, unknown>;
        expect(new ObjectData(encoded.description, { version: 425 }).decode(RichText).text).toBe('Hello');
        expect(encoded.optionalDescription).toBeNull();
    });

    it('upgrades a put and a full patch from an older client to a Dutch patch', () => {
        const struct = TestStruct.create({
            description: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
        });

        for (const value of [english.encode({ version: 425 }), RichText.patch({ html: '<p>Hello</p>', text: 'Hello' }).encode({ version: 425 })]) {
            const encoded = TestStruct.patch({}).encode({ version: 425 }) as Record<string, unknown>;
            encoded.description = value;

            const decoded = new ObjectData(encoded, { version: 425 }).decode(TestStruct.patchType());
            expect(decoded.description).toBeInstanceOf(TranslatedRichTextPatch);

            const patched = struct.patch(decoded);
            expect(patched.description.get(Language.Dutch).text).toBe('Hello');
            expect(patched.description.get(Language.French).text).toBe('Bonjour');
        }
    });

    it('rejects a partial RichText patch from an older client', () => {
        const encoded = TestStruct.patch({}).encode({ version: 425 }) as Record<string, unknown>;
        encoded.description = RichText.patch({ html: '<p>Hello</p>' }).encode({ version: 425 });

        expect(() => new ObjectData(encoded, { version: 425 }).decode(TestStruct.patchType())).toThrow();
    });

    it('downgrades a patch for older clients', () => {
        const languagePatch = TestStruct.patch({
            description: new TranslatedRichTextPatch({ [Language.Dutch]: dutch, [Language.French]: french }),
        });
        const encoded = languagePatch.encode({ version: 425 }) as Record<string, unknown>;
        expect(new ObjectData(encoded.description, { version: 425 }).decode(RichText).text).toBe('Hallo');

        const fullPatch = TestStruct.patch({
            description: TranslatedRichText.create({ [Language.French]: french }),
            optionalDescription: null,
        });
        const encodedFull = fullPatch.encode({ version: 425 }) as Record<string, unknown>;
        expect(new ObjectData(encodedFull.description, { version: 425 }).decode(RichText).text).toBe('Bonjour');
        expect(encodedFull.optionalDescription).toBeNull();
    });

    it('downgrades a patch without a displayable language to no change', () => {
        const patch = TestStruct.patch({
            description: new TranslatedRichTextPatch({ [Language.Dutch]: null }),
        });
        const encoded = patch.encode({ version: 425 }) as Record<string, unknown>;
        expect(encoded.description).toBeUndefined();
    });
});
