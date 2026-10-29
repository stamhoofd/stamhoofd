import { ObjectData } from '@common/encoding';
import { Language } from '@stamhoofd/types/Language';
import { Event } from './Event.js';
import { TranslatedString, TranslatedStringPatch } from './TranslatedString.js';
import { Version } from './Version.js';

describe('Event.name: string → TranslatedString', () => {
    const event = Event.create({
        id: 'event-1',
        typeId: 'type-1',
        name: new TranslatedString({ nl: 'Zomerkamp', en: 'Summer camp' }),
        startDate: new Date(2026, 6, 1),
        endDate: new Date(2026, 6, 10),
    });

    it('downgrades a translated name to the string in the current language', () => {
        const encoded = event.encode({ version: Version - 1 }) as { name: unknown };
        expect(encoded.name).toBe(event.name.get($getLanguage()));
    });

    it('keeps every translation at the current version', () => {
        const encoded = event.encode({ version: Version }) as { name: unknown };
        expect(encoded.name).toEqual({ nl: 'Zomerkamp', en: 'Summer camp' });

        const decoded = new ObjectData(encoded, { version: Version }).decode(Event);
        expect(decoded.name).toEqual(event.name);
    });

    it('upgrades a plain string name from an old client to an untranslated TranslatedString', () => {
        const encoded = event.encode({ version: Version - 1 }) as { name: unknown };
        encoded.name = 'Kamp';

        const decoded = new ObjectData(encoded, { version: Version - 1 }).decode(Event);
        expect(decoded.name).toEqual(TranslatedString.create('Kamp'));
        expect(decoded.name.isDefault).toBe(true);
        expect(decoded.getNameWithPeriod()).toBe('Kamp (2026)');
        expect(decoded.slug).toBe('2026/kamp/event-1');
    });

    it('upgrades a string name patch to a Dutch translation patch', () => {
        // What a client on the previous version sends when it changes the name
        const encodedPatch = { id: 'event-1', name: 'Kamp' };

        const decoded = new ObjectData(encodedPatch, { version: Version - 1 }).decode(Event.patchType());
        expect(decoded.name).toEqual(new TranslatedStringPatch({ [Language.Dutch]: 'Kamp' }));
        expect(event.patch(decoded).name).toEqual(new TranslatedString({ nl: 'Kamp', en: 'Summer camp' }));
    });

    it('downgrades a translation patch to the string for the current language', () => {
        const patch = Event.patch({ id: 'event-1', name: TranslatedString.patch({ nl: 'Kamp', en: 'Camp' }) });
        const encoded = patch.encode({ version: Version - 1 }) as { name: unknown };
        expect(encoded.name).toBe($getLanguage() === Language.English ? 'Camp' : 'Kamp');
    });
});
