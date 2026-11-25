import { TranslatedString } from './TranslatedString.js';

describe('TranslatedString.hasMinimumLength', () => {
    it('is false without any translation', () => {
        expect(new TranslatedString().hasMinimumLength(2)).toBe(false);
        expect(new TranslatedString({}).hasMinimumLength(2)).toBe(false);
    });

    it('measures an untranslated string', () => {
        expect(new TranslatedString('A').hasMinimumLength(2)).toBe(false);
        expect(new TranslatedString(' A ').hasMinimumLength(2)).toBe(false);
        expect(new TranslatedString('Kamp').hasMinimumLength(2)).toBe(true);
    });

    it('requires every translation to be long enough', () => {
        expect(new TranslatedString({ nl: 'Zomerkamp', en: 'Summer camp' }).hasMinimumLength(2)).toBe(true);
        expect(new TranslatedString({ nl: 'Zomerkamp', en: 'X' }).hasMinimumLength(2)).toBe(false);
    });
});
