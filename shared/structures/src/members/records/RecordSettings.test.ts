import { ObjectData } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';
import { describe, expect, it } from 'vitest';

import { RichText } from '../../RichText.js';
import { TranslatedLongText } from '../../TranslatedLongText.js';
import { TranslatedRichText, TranslatedRichTextPatch } from '../../TranslatedRichText.js';
import { TranslatedString, TranslatedStringDecoder, TranslatedStringPatch } from '../../TranslatedString.js';
import { TranslatedText } from '../../TranslatedText.js';
import { Version } from '../../Version.js';
import { RecordChoice, RecordSettings, RecordWarning } from './RecordSettings.js';

/**
 * 369 predates the TranslatedString migration, Version - 1 is a client that has it.
 */
describe('RecordWarning.text', () => {
    it('turns the line breaks of a plain string from before 370 into paragraphs', () => {
        const warning = new ObjectData({ id: '1', text: 'Opgelet.\nBel de ouders.' }, { version: 369 }).decode(RecordWarning);

        expect(warning.text).toBeInstanceOf(TranslatedRichText);
        expect(warning.text.html).toBe('<p>Opgelet.</p><p>Bel de ouders.</p>');
    });

    it('converts every language of a translated string', () => {
        const encoded = { id: '1', text: { [Language.Dutch]: 'Opgelet.\nBel de ouders.', [Language.French]: 'Attention.' } };
        const warning = new ObjectData(encoded, { version: Version - 1 }).decode(RecordWarning);

        expect(warning.text.get(Language.Dutch).html).toBe('<p>Opgelet.</p><p>Bel de ouders.</p>');
        expect(warning.text.get(Language.French).html).toBe('<p>Attention.</p>');
    });

    it('downgrades to a translated string for an older client', () => {
        const warning = RecordWarning.create({
            text: TranslatedRichText.create({
                [Language.Dutch]: RichText.create({ html: '<p>Opgelet.</p><p>Bel de ouders.</p>', text: 'Opgelet.\nBel de ouders.' }),
                [Language.French]: RichText.create({ html: '<p>Attention.</p>', text: 'Attention.' }),
            }),
        });

        const encoded = warning.encode({ version: Version - 1 }) as Record<string, unknown>;
        const text = new ObjectData(encoded.text, { version: Version - 1 }).decode(TranslatedStringDecoder);
        expect(text.get(Language.Dutch)).toBe('Opgelet.\nBel de ouders.');
        expect(text.get(Language.French)).toBe('Attention.');
    });

    it('downgrades to a plain string for a client from before 370', () => {
        const warning = RecordWarning.create({
            text: TranslatedRichText.create(RichText.create({ html: '<p>Opgelet.</p>', text: 'Opgelet.' })),
        });

        expect((warning.encode({ version: 369 }) as Record<string, unknown>).text).toBe('Opgelet.');
    });

    it('only changes the patched language for a patch of an older client', () => {
        const warning = RecordWarning.create({
            text: TranslatedRichText.create({
                [Language.Dutch]: RichText.create({ html: '<p>Opgelet.</p>', text: 'Opgelet.' }),
                [Language.French]: RichText.create({ html: '<p>Attention.</p>', text: 'Attention.' }),
            }),
        });

        const encoded = { id: warning.id, text: new TranslatedStringPatch({ [Language.Dutch]: 'Nieuw.' }).encode({ version: Version - 1 }) };
        const patch = new ObjectData(encoded, { version: Version - 1 }).decode(RecordWarning.patchType());
        const patched = warning.patch(patch);
        expect(patched.text.get(Language.Dutch).html).toBe('<p>Nieuw.</p>');
        expect(patched.text.get(Language.French).text).toBe('Attention.');
    });

    it('replaces the whole value for an unpatched translated string of an older client', () => {
        const warning = RecordWarning.create({
            text: TranslatedRichText.create({
                [Language.Dutch]: RichText.create({ html: '<p>Opgelet.</p>', text: 'Opgelet.' }),
                [Language.French]: RichText.create({ html: '<p>Attention.</p>', text: 'Attention.' }),
            }),
        });

        const patch = new ObjectData({ id: warning.id, text: { [Language.Dutch]: 'Nieuw.' } }, { version: Version - 1 }).decode(RecordWarning.patchType());
        expect(warning.patch(patch).text.languages).toEqual([Language.Dutch]);
    });

    it('downgrades a language patch to a translated string patch', () => {
        const patch = RecordWarning.patch({
            text: new TranslatedRichTextPatch({ [Language.Dutch]: RichText.create({ html: '<p>Nieuw.</p>', text: 'Nieuw.' }), [Language.French]: null }),
        });

        const encoded = patch.encode({ version: Version - 1 }) as Record<string, any>;
        expect(encoded.text).toMatchObject({ _isPatch: true, [Language.Dutch]: 'Nieuw.', [Language.French]: null });
    });
});

describe('RecordChoice.description', () => {
    it('turns the line breaks of an existing description into paragraphs', () => {
        const choice = new ObjectData({ id: '1', name: 'Ja', description: 'Eerste regel\nTweede regel' }, { version: 369 }).decode(RecordChoice);

        expect(choice.description.html).toBe('<p>Eerste regel</p><p>Tweede regel</p>');
    });

    it('keeps every translation in the latest version', () => {
        const choice = RecordChoice.create({
            name: TranslatedText.create('Ja'),
            description: TranslatedRichText.create({
                [Language.Dutch]: RichText.create({ html: '<p>Ja</p>', text: 'Ja' }),
                [Language.French]: RichText.create({ html: '<p>Oui</p>', text: 'Oui' }),
            }),
        });

        const decoded = new ObjectData(choice.encode({ version: Version }), { version: Version }).decode(RecordChoice);
        expect(decoded.description.get(Language.French).text).toBe('Oui');
    });
});

/**
 * Both types encode exactly like the TranslatedString they replace, so 369 (a plain string) and
 * Version - 1 (a translated string) both still work.
 */
describe('RecordSettings plain text types', () => {
    it('reads a plain string from before 370', () => {
        const settings = new ObjectData({ id: '1', name: 'Allergieën', description: 'Eerste regel\nTweede regel' }, { version: 369 }).decode(RecordSettings);

        expect(settings.name).toBeInstanceOf(TranslatedText);
        expect(settings.name.toString()).toBe('Allergieën');
        expect(settings.description).toBeInstanceOf(TranslatedLongText);
        // Only rich text can contain lines
        expect(settings.description.toString()).toBe('Eerste regel Tweede regel');
    });

    it('keeps every language of a translated string of an older client', () => {
        const encoded = { id: '1', name: { [Language.Dutch]: 'Allergieën', [Language.French]: 'Allergies' } };
        const settings = new ObjectData(encoded, { version: Version - 1 }).decode(RecordSettings);

        expect(settings.name.get(Language.Dutch)).toBe('Allergieën');
        expect(settings.name.get(Language.French)).toBe('Allergies');
    });

    it('encodes identically to the TranslatedString it replaces', () => {
        const translations = { [Language.Dutch]: 'Allergieën', [Language.French]: 'Allergies' };
        const settings = RecordSettings.create({ name: TranslatedText.create(translations) });

        expect((settings.encode({ version: Version }) as Record<string, unknown>).name)
            .toEqual(TranslatedString.create(translations).encode({ version: Version }));
    });

    it('only changes the patched language for a language patch of an older client', () => {
        const settings = RecordSettings.create({
            name: TranslatedText.create({ [Language.Dutch]: 'Allergieën', [Language.French]: 'Allergies' }),
        });

        const encoded = { id: settings.id, name: new TranslatedStringPatch({ [Language.Dutch]: 'Nieuw' }).encode({ version: Version - 1 }) };
        const patched = settings.patch(new ObjectData(encoded, { version: Version - 1 }).decode(RecordSettings.patchType()));

        expect(patched.name.get(Language.Dutch)).toBe('Nieuw');
        expect(patched.name.get(Language.French)).toBe('Allergies');
    });
});
