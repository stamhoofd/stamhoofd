import { ObjectData } from '@common/encoding';
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
});
