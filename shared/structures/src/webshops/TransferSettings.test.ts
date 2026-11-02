import { ObjectData } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';
import { describe, expect, it } from 'vitest';

import { RichText } from '../RichText.js';
import { TranslatedRichText } from '../TranslatedRichText.js';
import { Version } from '../Version.js';
import { TransferSettings } from './TransferSettings.js';

/**
 * Version - 1 behaves as an older client: infoDescription became a TranslatedRichText in the current
 * Version, which was bumped manually because NextVersion does not support upgrade/downgrade.
 */
describe('TransferSettings.infoDescription', () => {
    it('turns the line breaks typed by an administrator into paragraphs', () => {
        const settings = new ObjectData({ infoDescription: 'Schrijf over naar BE123\n\nVermeld je naam' }, { version: Version - 1 }).decode(TransferSettings);

        expect(settings.infoDescription).toBeInstanceOf(TranslatedRichText);
        expect(settings.infoDescription.html).toBe('<p>Schrijf over naar BE123</p><p></p><p>Vermeld je naam</p>');
    });

    it('is empty in a new configuration', () => {
        expect(TransferSettings.create({}).infoDescription.text).toBe('');
    });

    it('downgrades to plain text for an older client', () => {
        const settings = TransferSettings.create({
            infoDescription: TranslatedRichText.create(RichText.create({ html: '<p>Hallo</p>', text: 'Hallo' })),
        });

        expect((settings.encode({ version: Version - 1 }) as Record<string, unknown>).infoDescription).toBe('Hallo');
    });

    it('keeps every translation in the latest version', () => {
        const settings = TransferSettings.create({
            infoDescription: TranslatedRichText.create({
                [Language.Dutch]: RichText.create({ html: '<p>Hallo</p>', text: 'Hallo' }),
                [Language.French]: RichText.create({ html: '<p>Bonjour</p>', text: 'Bonjour' }),
            }),
        });

        const decoded = new ObjectData(settings.encode({ version: Version }), { version: Version }).decode(TransferSettings);
        expect(decoded.infoDescription.get(Language.French).text).toBe('Bonjour');
    });
});
