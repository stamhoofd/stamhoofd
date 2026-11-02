import { ObjectData } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';
import { describe, expect, it } from 'vitest';

import { MemberResponsibility } from './MemberResponsibility.js';
import { RichText } from './RichText.js';
import { TranslatedRichText } from './TranslatedRichText.js';
import { Version } from './Version.js';

/**
 * The description became a TranslatedRichText in the current Version, so Version - 1 behaves as an
 * older client that still sends and expects a plain string.
 */
describe('MemberResponsibility.description', () => {
    it('turns the line breaks of an existing description into paragraphs', () => {
        const responsibility = new ObjectData({ id: '1', name: 'Kassier', description: 'Beheert de rekening.\nVolgt de betalingen op.' }, { version: Version - 1 }).decode(MemberResponsibility);

        expect(responsibility.description).toBeInstanceOf(TranslatedRichText);
        expect(responsibility.description.html).toBe('<p>Beheert de rekening.</p><p>Volgt de betalingen op.</p>');
    });

    it('downgrades to plain text for an older client', () => {
        const responsibility = MemberResponsibility.create({
            name: 'Kassier',
            description: TranslatedRichText.create({
                [Language.Dutch]: RichText.create({ html: '<p>Beheert de rekening.</p>', text: 'Beheert de rekening.' }),
            }),
        });

        expect((responsibility.encode({ version: Version - 1 }) as Record<string, unknown>).description).toBe('Beheert de rekening.');
    });

    it('keeps every translation in the latest version', () => {
        const responsibility = MemberResponsibility.create({
            name: 'Kassier',
            description: TranslatedRichText.create({
                [Language.Dutch]: RichText.create({ html: '<p>Kassier</p>', text: 'Kassier' }),
                [Language.French]: RichText.create({ html: '<p>Trésorier</p>', text: 'Trésorier' }),
            }),
        });

        const decoded = new ObjectData(responsibility.encode({ version: Version }), { version: Version }).decode(MemberResponsibility);
        expect(decoded.description.get(Language.French).text).toBe('Trésorier');
    });
});
