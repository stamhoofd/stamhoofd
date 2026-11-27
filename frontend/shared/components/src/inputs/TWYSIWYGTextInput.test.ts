import type { ComponentWithProperties } from '@browser/navigation';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { RichText, TranslatedRichText } from '@stamhoofd/structures';
import { TranslateResponse } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import type { TranslateRequest } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { userEvent } from 'vitest/browser';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { reactive } from 'vue';

import type { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { ModalStackEventBus } from '../overlays/ModalStackEventBus';
import { EditorContext } from './hooks/useEditorContext';
import TWYSIWYGTextInput from './TWYSIWYGTextInput.vue';

function renderInput(modelValue: TranslatedRichText, context?: object) {
    return render(TWYSIWYGTextInput, {
        props: {
            title: 'Beschrijving',
            modelValue,
        },
        global: {
            provide: {
                'editor-context': reactive(new EditorContext()),
                '$context': context,
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t,
                    $isMobile: false,
                } as any,
            },
            directives: {
                tooltip: {},
            },
        },
    });
}

function lastModelValue(result: ReturnType<typeof renderInput>) {
    return result.emitted<[TranslatedRichText]>('update:modelValue')?.at(-1)?.[0];
}

async function loadLanguages() {
    await I18nController.loadDefault({
        defaultCountry: Country.Belgium,
        defaultLanguage: Language.Dutch,
        preferredLanguage: Language.Dutch,
        country: Country.Belgium,
        locales: {
            [Country.Belgium]: [Language.Dutch, Language.English],
        },
    });
}

function editors() {
    return Array.from(document.querySelectorAll<HTMLElement>('.t-wysiwyg-text-input .ProseMirror'));
}

test('TWYSIWYGTextInput shows one editor per language in the configured order', async () => {
    await loadLanguages();
    const result = renderInput(new TranslatedRichText({
        [Language.English]: RichText.create({ text: 'Hello', html: '<p>Hello</p>' }),
        [Language.Dutch]: RichText.create({ text: 'Hallo', html: '<p>Hallo</p>' }),
    }));

    await vi.waitFor(() => {
        expect(editors().map(e => e.textContent)).toEqual(['Hallo', 'Hello']);
    });
    expect(Array.from(document.querySelectorAll('.t-wysiwyg-text-input > span')).map(s => s.textContent?.trim())).toEqual(['NL', 'EN']);
    await result.unmount();
});

test('TWYSIWYGTextInput removes a cleared language and becomes untranslated when the last one is cleared', async () => {
    await loadLanguages();
    const result = renderInput(new TranslatedRichText({
        [Language.Dutch]: RichText.create({ text: 'Hallo', html: '<p>Hallo</p>' }),
        [Language.English]: RichText.create({ text: 'Hello', html: '<p>Hello</p>' }),
    }));

    await vi.waitFor(() => expect(editors()).toHaveLength(2));
    await userEvent.fill(editors()[1], '');

    await vi.waitFor(() => {
        const value = lastModelValue(result);
        expect(value?.languages).toEqual([Language.Dutch]);
        expect(value?.getIfExists(Language.Dutch)?.text).toBe('Hallo');
    });
    await result.unmount();

    const single = renderInput(new TranslatedRichText({
        [Language.Dutch]: RichText.create({ text: 'Hallo', html: '<p>Hallo</p>' }),
    }));
    await vi.waitFor(() => expect(editors()).toHaveLength(1));
    await userEvent.fill(editors()[0], '');

    await vi.waitFor(() => {
        const value = lastModelValue(single);
        expect(value?.isDefault).toBe(true);
        expect(value?.text).toBe('');
    });
    await single.rerender({ modelValue: lastModelValue(single) });
    expect(editors()).toHaveLength(1);
    expect(document.querySelector('.t-wysiwyg-text-input > span')).toBeNull();
    await single.unmount();
});

test('TWYSIWYGTextInput edits an untranslated value without adding languages', async () => {
    await loadLanguages();
    const result = renderInput(new TranslatedRichText(RichText.create({ text: 'Hallo', html: '<p>Hallo</p>' })));

    await vi.waitFor(() => expect(editors().map(e => e.textContent)).toEqual(['Hallo']));
    await userEvent.fill(editors()[0], 'Dag');

    await vi.waitFor(() => {
        const value = lastModelValue(result);
        expect(value?.isDefault).toBe(true);
        expect(value?.text).toBe('Dag');
    });
    await result.unmount();
});

/**
 * Opens the language menu and returns the item that starts the automatic translation
 */
async function openTranslateItem(): Promise<ContextMenuItem | undefined> {
    const owner = {};
    const presented = new Promise<ContextMenuItem[]>((resolve) => {
        ModalStackEventBus.addListener(owner, 'present', (options) => {
            const component = ('components' in options ? options.components[0] : options) as ComponentWithProperties;
            resolve((component.properties.menu as ContextMenu).items.flat());
            return Promise.resolve();
        });
    });
    (document.querySelector('button.icon.translate') as HTMLButtonElement).click();
    try {
        return (await presented).find(item => item.icon === 'wand');
    } finally {
        ModalStackEventBus.removeListener(owner);
    }
}

test('TWYSIWYGTextInput fills the other languages with an automatic translation', async () => {
    await loadLanguages();
    const requests: TranslateRequest[] = [];
    const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hallo' }] }] };
    const result = renderInput(
        new TranslatedRichText({ [Language.Dutch]: RichText.create({ text: 'Hallo', html: '<p>Hallo</p>', json }) }),
        {
            auth: { hasPlatformFullAccess: () => true },
            authenticatedServer: {
                request: (options: { body: TranslateRequest }) => {
                    requests.push(options.body);
                    return Promise.resolve({ data: TranslateResponse.create({
                        translations: new Map(options.body.targetLanguages.map(language => [language, new Map<string, any>([
                            ['body', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${language}: Hallo` }] }] }],
                        ])])),
                    }) });
                },
            },
        },
    );

    await vi.waitFor(() => expect(editors()).toHaveLength(1));
    const item = await openTranslateItem();
    expect(item).toBeDefined();
    await item!.action!();

    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].sourceLanguage).toBe(Language.Dutch);
    expect(requests[0].targetLanguages).toEqual([Language.English]);
    expect(requests[0].inputs.get('body')).toEqual(json);

    await vi.waitFor(() => {
        const value = lastModelValue(result);
        expect(value?.languages).toEqual([Language.Dutch, Language.English]);
        expect(value?.getIfExists(Language.English)?.text).toBe('en: Hallo');
        expect(value?.getIfExists(Language.English)?.html).toBe('<p>en: Hallo</p>');
    });
    await result.unmount();
});
