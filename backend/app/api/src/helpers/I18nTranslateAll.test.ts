import { I18n } from '@stamhoofd/backend-i18n';
import { TranslatedString } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';

describe('I18n.translateAll / I18n.mapLanguages', () => {
    const translate = (language: Language, key: string, replace?: Record<string, string>) => new I18n(language, Country.Belgium).$t(key, replace);

    beforeEach(() => {
        TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.English, Language.French] });
    });

    test('lists the platform languages once, in the order of the locales list', () => {
        TestUtils.setEnvironment('locales', { BE: [Language.French, Language.Dutch], NL: [Language.Dutch, Language.English] });
        expect(I18n.languages).toEqual([Language.Dutch, Language.English, Language.French]);
    });

    test('translates a key in every platform language, regardless of the current language', () => {
        const dutch = new I18n(Language.Dutch, Country.Belgium);
        const translated = I18n.runWithLocale(dutch, () => I18n.translateAll('%Ot'));

        expect(translated.languages.sort()).toEqual([Language.Dutch, Language.English, Language.French].sort());
        expect(translated.get(Language.Dutch)).toBe('Vrije bijdrage');
        expect(translated.get(Language.English)).toBe(translate(Language.English, '%Ot'));
        expect(translated.get(Language.French)).toBe(translate(Language.French, '%Ot'));
        expect(translated.get(Language.English)).not.toBe(translated.get(Language.Dutch));

        // The current language is restored afterwards
        expect($getLanguage()).toBe(Language.Dutch);
    });

    test('inserts a translated replacement in the matching language', () => {
        const group = new TranslatedString({ nl: 'Kapoenen', en: 'Cubs', fr: 'Louveteaux' });
        const translated = I18n.translateAll('%1Mt', { name: 'Jan', group });

        expect(translated.get(Language.Dutch)).toBe(translate(Language.Dutch, '%1Mt', { name: 'Jan', group: 'Kapoenen' }));
        expect(translated.get(Language.English)).toBe(translate(Language.English, '%1Mt', { name: 'Jan', group: 'Cubs' }));
        expect(translated.get(Language.French)).toBe(translate(Language.French, '%1Mt', { name: 'Jan', group: 'Louveteaux' }));
    });

    test('runs the builder with each language as the current language, so dates are formatted per language', () => {
        const date = new Date(2026, 6, 15, 12);
        const translated = I18n.mapLanguages(language => $getLanguage() + ':' + language + ':' + $t('%1cJ', { date: Formatter.date(date, true) }));

        for (const language of [Language.Dutch, Language.English, Language.French]) {
            const expected = I18n.runWithLocale(new I18n(language, Country.Belgium), () => $t('%1cJ', { date: Formatter.date(date, true) }));
            expect(translated.get(language)).toBe(language + ':' + language + ':' + expected);
        }
        expect(translated.get(Language.Dutch)).not.toBe(translated.get(Language.English));
    });

    test('a platform with one language yields a value that encodes as a plain string', () => {
        TestUtils.setEnvironment('locales', { BE: [Language.Dutch] });
        const translated = I18n.translateAll('%Ot');

        expect(translated.languages).toEqual([Language.Dutch]);
        expect(translated.encode({ version: 426 })).toBe('Vrije bijdrage');
    });
});
