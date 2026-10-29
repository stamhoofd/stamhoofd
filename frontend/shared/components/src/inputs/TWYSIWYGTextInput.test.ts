import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { RichText, TranslatedRichText } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { userEvent } from 'vitest/browser';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { reactive } from 'vue';

import { EditorContext } from './hooks/useEditorContext';
import TWYSIWYGTextInput from './TWYSIWYGTextInput.vue';

function renderInput(modelValue: TranslatedRichText) {
    return render(TWYSIWYGTextInput, {
        props: {
            title: 'Beschrijving',
            modelValue,
        },
        global: {
            provide: {
                'editor-context': reactive(new EditorContext()),
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
