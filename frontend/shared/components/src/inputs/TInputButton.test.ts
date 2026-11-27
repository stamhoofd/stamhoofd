import type { ComponentWithProperties } from '@browser/navigation';
import { RichText, TranslatedRichText, TranslatedString } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';

import type { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { ModalStackEventBus } from '../overlays/ModalStackEventBus';
import type { TranslateableValue } from './hooks/useEditorContext';
import TInputButton from './TInputButton.vue';

const dutch = RichText.create({ html: '<p>Hallo</p>', text: 'Hallo' });

function enableMultipleLanguages() {
    TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French, Language.English] });
}

function renderButton(modelValue: TranslateableValue, options: { platformAdmin?: boolean; onTranslate?: () => void } = {}) {
    render(TInputButton, {
        props: {
            modelValue,
            onTranslate: options.onTranslate,
        },
        global: {
            provide: {
                $context: { auth: { hasPlatformFullAccess: () => options.platformAdmin ?? false } },
            },
        },
    });
}

function queryButton() {
    return document.querySelector('button.icon.translate') as HTMLButtonElement;
}

/**
 * Opening the menu presents a GeneralContextMenuView on the modal stack: capture it and return
 * the flattened menu items so the tests can assert on the menu without rendering it.
 */
async function openMenu(): Promise<ContextMenuItem[]> {
    const owner = {};
    const presented = new Promise<ContextMenuItem[]>((resolve) => {
        ModalStackEventBus.addListener(owner, 'present', (options) => {
            const component = ('components' in options ? options.components[0] : options) as ComponentWithProperties;
            resolve((component.properties.menu as ContextMenu).items.flat());
            return Promise.resolve();
        });
    });
    queryButton().click();
    try {
        return await presented;
    } finally {
        ModalStackEventBus.removeListener(owner);
    }
}

function findTranslateItem(items: ContextMenuItem[]) {
    return items.find(item => item.icon === 'wand');
}

test('offers AI translation of a rich text to a platform admin', async () => {
    enableMultipleLanguages();
    renderButton(TranslatedRichText.create({ [Language.Dutch]: dutch }), { platformAdmin: true });
    expect(findTranslateItem(await openMenu())).toBeDefined();
});

test('hides AI translation for users without full platform access', async () => {
    enableMultipleLanguages();
    renderButton(TranslatedRichText.create({ [Language.Dutch]: dutch }));
    expect(findTranslateItem(await openMenu())).toBeUndefined();
});

test('hides AI translation while the rich text has no language', async () => {
    enableMultipleLanguages();
    renderButton(TranslatedRichText.create(dutch), { platformAdmin: true });
    expect(findTranslateItem(await openMenu())).toBeUndefined();
});

test('hides AI translation for a translated string', async () => {
    enableMultipleLanguages();
    renderButton(new TranslatedString({ [Language.Dutch]: 'Hallo' }), { platformAdmin: true });
    expect(findTranslateItem(await openMenu())).toBeUndefined();
});

test('the AI translation item emits translate', async () => {
    enableMultipleLanguages();
    const emitted: string[] = [];
    renderButton(TranslatedRichText.create({ [Language.Dutch]: dutch }), { platformAdmin: true, onTranslate: () => emitted.push('translate') });

    findTranslateItem(await openMenu())!.action!();

    expect(emitted).toEqual(['translate']);
});
