import { I18n } from '@stamhoofd/backend-i18n';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';

describe('backend translation replacements', () => {
    test('preserves literal keys, repeated placeholders, empty and stringifiable values', () => {
        const i18n = new I18n(Language.Dutch, Country.Belgium);
        expect(i18n.replace('{a.b} {a.b}/{empty}/{value}/{missing}', {
            'a.b': 'Jan', empty: '', value: { toString: () => '42' },
        })).toBe('Jan Jan//42/{missing}');
    });

    test('preserves sequential replacements and literal translation arguments', () => {
        const i18n = new I18n(Language.Dutch, Country.Belgium);
        const replacements = { first: '{second}', second: 'Jan' };
        expect(i18n.t('{first}', replacements)).toBe('Jan');
        expect(replacements).toEqual({ first: '{second}', second: 'Jan' });
        expect(i18n.t('{first}')).toBe('{first}');
    });
});
