import { I18n } from '@stamhoofd/frontend-i18n/I18n.ts';
import { describe, expect, test } from 'vitest';

describe('frontend translation replacements', () => {
    test('preserves literal keys, repeated placeholders, empty and stringifiable values', () => {
        const i18n = new I18n();
        expect(i18n.replace('{a.b} {a.b}/{empty}/{value}/{missing}', {
            'a.b': 'Jan', 'empty': '', 'value': { toString: () => '42' },
        })).toBe('Jan Jan//42/{missing}');
    });

    test('preserves sequential replacements without mutating literal arguments', () => {
        const i18n = new I18n();
        const replacements = { first: '{second}', second: 'Jan' };
        expect(i18n.replace('{first}', replacements)).toBe('Jan');
        expect(replacements).toEqual({ first: '{second}', second: 'Jan' });
        expect(i18n.replace('{first}')).toBe('{first}');
    });
});
