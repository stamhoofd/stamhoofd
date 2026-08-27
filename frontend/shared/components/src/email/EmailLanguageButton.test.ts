import { LanguageHelper, Platform } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import EmailLanguageButton from './EmailLanguageButton.vue';
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { ModalStackEventBus } from '../overlays/ModalStackEventBus';

/**
 * The button only ever shows when there is more than one language to translate to
 */
function enableMultipleLanguages() {
    TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French, Language.English] });
}

function renderButton(props: { modelValue?: Language | null; languages?: Language[]; defaultLanguage?: Language | null; supportsTranslations: boolean }, options: { featureFlags?: string[]; platformAdmin?: boolean } = {}) {
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
                $context: { organization: { privateMeta: { featureFlags: options.featureFlags ?? [] } }, platform: Platform.create({}), auth: { hasPlatformFullAccess: () => options.platformAdmin ?? false } },
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

test('existing translations (if more than 1) remain manageable when translations are not supported', () => {
    enableMultipleLanguages();
    renderButton({ languages: [Language.French, Language.English], supportsTranslations: false });
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

/**
 * Opening the menu presents a GeneralContextMenuView on the modal stack: capture it and return
 * the flattened menu items so the tests can assert on the menu without rendering it.
 */
async function openMenu(): Promise<ContextMenuItem[]> {
    const owner = {};
    const presented = new Promise<ContextMenuItem[]>((resolve) => {
        ModalStackEventBus.addListener(owner, 'present', (options) => {
            const component = ('components' in options ? options.components[0] : options) as ComponentWithProperties;
            const menu = component.properties.menu as ContextMenu;
            resolve(menu.items.flat());
            return Promise.resolve();
        });
    });
    (queryButton() as HTMLButtonElement).click();
    try {
        return await presented;
    } finally {
        ModalStackEventBus.removeListener(owner);
    }
}

function findTranslateItem(items: ContextMenuItem[]) {
    return items.find(item => item.icon === 'wand');
}

test('offers AI translation to a platform admin while the content has a single language', async () => {
    enableMultipleLanguages();
    renderButton({ modelValue: Language.Dutch, languages: [Language.Dutch], supportsTranslations: true }, { featureFlags: ['email-translations'], platformAdmin: true });
    expect(findTranslateItem(await openMenu())).toBeDefined();
});

test('hides AI translation for users without full platform access', async () => {
    enableMultipleLanguages();
    renderButton({ modelValue: Language.Dutch, languages: [Language.Dutch], supportsTranslations: true }, { featureFlags: ['email-translations'] });
    expect(findTranslateItem(await openMenu())).toBeUndefined();
});

test('offers AI translation when the content is already translated', async () => {
    enableMultipleLanguages();
    renderButton({ modelValue: Language.Dutch, languages: [Language.Dutch, Language.French, Language.English], supportsTranslations: true }, { featureFlags: ['email-translations'], platformAdmin: true });
    expect(findTranslateItem(await openMenu())).toBeDefined();
});

test('hides AI translation while no language is set', async () => {
    enableMultipleLanguages();
    renderButton({ supportsTranslations: true }, { featureFlags: ['email-translations'], platformAdmin: true });
    expect(findTranslateItem(await openMenu())).toBeUndefined();
});

test('the AI translation item emits translate', async () => {
    enableMultipleLanguages();
    const emitted: string[] = [];
    render(EmailLanguageButton, {
        props: {
            modelValue: Language.Dutch,
            languages: [Language.Dutch],
            defaultLanguage: Language.Dutch,
            supportsTranslations: true,
            onTranslate: () => emitted.push('translate'),
        },
        global: {
            provide: {
                $context: { organization: { privateMeta: { featureFlags: ['email-translations'] } }, platform: Platform.create({}), auth: { hasPlatformFullAccess: () => true } },
            },
        },
    });
    findTranslateItem(await openMenu())!.action!();
    expect(emitted).toEqual(['translate']);
});
