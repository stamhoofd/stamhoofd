import { I18n } from '@stamhoofd/backend-i18n';
import { loadTestLocales } from './test-locales.js';

test('prepared translations retain their values without sharing mutable locale maps', () => {
    const original = I18n.loadedLocales.get('nl-BE')!;
    expect(original.size).toBeGreaterThan(0);
    const [key, value] = original.entries().next().value!;
    original.set(key, 'changed by a test');
    I18n.loadedLocales.set('test-locale', new Map());

    loadTestLocales();

    expect(I18n.loadedLocales.get('nl-BE')).not.toBe(original);
    expect(I18n.loadedLocales.get('nl-BE')!.get(key)).toBe(value);
    expect(I18n.loadedLocales.has('test-locale')).toBe(false);
});
