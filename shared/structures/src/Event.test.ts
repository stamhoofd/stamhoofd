import { ObjectData } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';

import { EventMeta } from './Event.js';
import { RichText } from './RichText.js';
import { TranslatedRichText, TranslatedRichTextPatch } from './TranslatedRichText.js';

const dutch = RichText.create({ html: '<p>Hallo</p>', text: 'Hallo' });
const french = RichText.create({ html: '<p>Bonjour</p>', text: 'Bonjour' });
const english = RichText.create({ html: '<p>Hello</p>', text: 'Hello' });

describe('EventMeta description versioning', () => {
    it('upgrades a RichText description from an older version', () => {
        const encoded = EventMeta.create({}).encode({ version: 425 }) as Record<string, unknown>;
        encoded.description = dutch.encode({ version: 425 });

        const decoded = new ObjectData(encoded, { version: 425 }).decode(EventMeta);
        expect(decoded.description).toBeInstanceOf(TranslatedRichText);
        expect(decoded.description.isDefault).toBe(true);
        expect(decoded.description.html).toBe('<p>Hallo</p>');
    });

    it('downgrades a translated description to a RichText for older clients', () => {
        const meta = EventMeta.create({
            description: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
        });

        const encoded = meta.encode({ version: 425 }) as Record<string, unknown>;
        const description = new ObjectData(encoded.description, { version: 425 }).decode(RichText);
        expect(['Hallo', 'Bonjour']).toContain(description.text);
    });

    it('keeps all translations when encoding and decoding the latest version', () => {
        const meta = EventMeta.create({
            description: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
        });

        const decoded = new ObjectData(meta.encode({ version: 426 }), { version: 426 }).decode(EventMeta);
        expect(decoded.description.get(Language.Dutch).text).toBe('Hallo');
        expect(decoded.description.get(Language.French).text).toBe('Bonjour');
    });

    it('upgrades a RichText patch from an older client', () => {
        const encoded = EventMeta.patch({}).encode({ version: 425 }) as Record<string, unknown>;
        encoded.description = dutch.encode({ version: 425 });

        const decoded = new ObjectData(encoded, { version: 425 }).decode(EventMeta.patchType());
        const patched = EventMeta.create({}).patch(decoded);
        expect(patched.description).toBeInstanceOf(TranslatedRichText);
        expect(patched.description.html).toBe('<p>Hallo</p>');
    });

    it('only changes the Dutch description for a patch from an older client', () => {
        const meta = EventMeta.create({
            description: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
        });

        const encoded = EventMeta.patch({}).encode({ version: 425 }) as Record<string, unknown>;
        encoded.description = english.encode({ version: 425 });

        const decoded = new ObjectData(encoded, { version: 425 }).decode(EventMeta.patchType());
        const patched = meta.patch(decoded);
        expect(patched.description.get(Language.Dutch).text).toBe('Hello');
        expect(patched.description.get(Language.French).text).toBe('Bonjour');
    });

    it('encodes and decodes a language patch', () => {
        const meta = EventMeta.create({
            description: TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french }),
        });
        const patch = EventMeta.patch({
            description: new TranslatedRichTextPatch({ [Language.English]: english, [Language.French]: null }),
        });

        const decoded = new ObjectData(patch.encode({ version: 426 }), { version: 426 }).decode(EventMeta.patchType());
        expect(decoded.description).toBeInstanceOf(TranslatedRichTextPatch);

        const patched = meta.patch(decoded);
        expect(patched.description.languages.sort()).toEqual([Language.Dutch, Language.English].sort());
    });

    it('downgrades a language patch to a RichText for older clients', () => {
        const patch = EventMeta.patch({
            description: new TranslatedRichTextPatch({ [Language.Dutch]: dutch }),
        });

        const encoded = patch.encode({ version: 425 }) as Record<string, unknown>;
        expect(new ObjectData(encoded.description, { version: 425 }).decode(RichText).text).toBe('Hallo');
    });

    it('applies a translated patch', () => {
        const description = TranslatedRichText.create({ [Language.Dutch]: dutch, [Language.French]: french });
        const patch = EventMeta.patch({ description });

        const decoded = new ObjectData(patch.encode({ version: 426 }), { version: 426 }).decode(EventMeta.patchType());
        const patched = EventMeta.create({}).patch(decoded);
        expect(patched.description.languages).toEqual([Language.Dutch, Language.French]);
    });
});
