import { LanguageHelper, Platform } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import EmailLanguageButton from './EmailLanguageButton.vue';

/**
 * The button only ever shows when there is more than one language to translate to
 */
function enableMultipleLanguages() {
    TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French, Language.English] });
}

function renderButton(props: { modelValue?: Language | null; languages?: Language[]; defaultLanguage?: Language | null; supportsTranslations: boolean }, options: { featureFlags?: string[] } = {}) {
    render(EmailLanguageButton, {
        props: {
            modelValue: props.modelValue ?? null,
            languages: props.languages ?? [],
            defaultLanguage: props.defaultLanguage ?? props.languages?.[0] ?? null,
            supportsTranslations: props.supportsTranslations,
        },
        global: {
            provide: {
                // useFeatureFlag reads the feature flags from the organization of the session context and the platform config
                $context: { organization: { privateMeta: { featureFlags: options.featureFlags ?? [] } } },
                $platformManager: { $platform: Platform.create({}) },
            },
        },
    });
}

function queryButton() {
    return document.querySelector('[data-testid="email-language-button"]');
}

test('visible when translations are supported and the feature flag is enabled', () => {
    enableMultipleLanguages();
    renderButton({ supportsTranslations: true }, { featureFlags: ['email-translations'] });
    expect(queryButton()).not.toBeNull();
});

test('hidden when translations are not supported, even with the feature flag enabled', () => {
    enableMultipleLanguages();
    renderButton({ supportsTranslations: false }, { featureFlags: ['email-translations'] });
    expect(queryButton()).toBeNull();
});

test('hidden when translations are supported but the feature flag is disabled', () => {
    enableMultipleLanguages();
    renderButton({ supportsTranslations: true });
    expect(queryButton()).toBeNull();
});

test('existing translations remain manageable when translations are not supported', () => {
    enableMultipleLanguages();
    renderButton({ languages: [Language.French], supportsTranslations: false });
    expect(queryButton()).not.toBeNull();
});

test('shows an icon-only button while no language is being edited', () => {
    enableMultipleLanguages();
    renderButton({ supportsTranslations: true }, { featureFlags: ['email-translations'] });
    expect(queryButton()?.textContent?.trim()).toBe('');
});

test('shows the name of the language that is being edited', () => {
    enableMultipleLanguages();
    renderButton({ modelValue: Language.French, languages: [Language.Dutch, Language.French], defaultLanguage: Language.Dutch, supportsTranslations: true }, { featureFlags: ['email-translations'] });
    expect(queryButton()?.textContent).toContain(LanguageHelper.getName(Language.French));
});
