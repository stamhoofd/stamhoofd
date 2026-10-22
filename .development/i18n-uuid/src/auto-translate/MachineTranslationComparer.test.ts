import { expect, it, vi } from 'vitest';
import { TranslatorType } from '../enums/TranslatorType.js';
import { globals } from '../shared/globals.js';
import { MachineTranslationComparer } from './MachineTranslationComparer.js';
import type { TranslationProvider } from './TranslationProvider.js';

function createProvider() {
    return {
        locales: [globals.DEFAULT_LOCALE, 'nl', 'fr-BE', 'en-GB'] as const,
        namespaces: ['stamhoofd', 'dashboard'] as const,
        getMappedLocale: vi.fn((locale: string) => locale === 'nl' ? globals.DEFAULT_LOCALE : locale),
        readDist: vi.fn<TranslationProvider['readDist']>(() => ({ greeting: 'Hallo', missing: 'Dag' })),
        readMachineTranslations: vi.fn<TranslationProvider['readMachineTranslations']>(() => ({ greeting: 'Bonjour', obsolete: 'Verouderd' })),
        setComparison: vi.fn<TranslationProvider['setComparison']>(),
    } satisfies TranslationProvider;
}

it('creates comparisons for each target locale and namespace, excluding mapped default locales', () => {
    const provider = createProvider();

    new MachineTranslationComparer(provider).createComparisons();

    expect(provider.setComparison.mock.calls.map(([, args]) => args)).toEqual([
        { locale: 'fr-BE', namespace: 'stamhoofd' },
        { locale: 'fr-BE', namespace: 'dashboard' },
        { locale: 'en-GB', namespace: 'stamhoofd' },
        { locale: 'en-GB', namespace: 'dashboard' },
    ]);
    expect(provider.readDist.mock.calls).toEqual([
        [globals.DEFAULT_LOCALE, 'stamhoofd'],
        [globals.DEFAULT_LOCALE, 'dashboard'],
        [globals.DEFAULT_LOCALE, 'stamhoofd'],
        [globals.DEFAULT_LOCALE, 'dashboard'],
    ]);
    expect(provider.readMachineTranslations.mock.calls).toEqual(
        provider.setComparison.mock.calls.flatMap(([, { locale, namespace }]) =>
            Object.values(TranslatorType).map(() => [locale, namespace]),
        ),
    );
});

it('keeps source text and missing translations while ignoring obsolete machine translation keys', () => {
    const provider = createProvider();

    new MachineTranslationComparer(provider).createComparisons();

    for (const [comparison] of provider.setComparison.mock.calls) {
        expect(comparison).toEqual({
            greeting: {
                original: 'Hallo',
                translations: Object.fromEntries(Object.values(TranslatorType).map(type => [type, 'Bonjour'])),
            },
            missing: { original: 'Dag', translations: {} },
        });
    }
});
