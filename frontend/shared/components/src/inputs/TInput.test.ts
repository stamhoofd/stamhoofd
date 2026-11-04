import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { TranslatedString } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { userEvent } from 'vitest/browser';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import type { Component } from 'vue';
import { reactive } from 'vue';

import { EditorContext } from './hooks/useEditorContext';
import TInput from './TInput.vue';
import TTextarea from './TTextarea.vue';

function renderInput(component: Component, modelValue: TranslatedString) {
    return render(component, {
        props: {
            title: 'Naam',
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
                autofocus: {},
            },
        },
    });
}

function lastModelValue(result: ReturnType<typeof renderInput>) {
    return result.emitted<[TranslatedString]>('update:modelValue')?.at(-1)?.[0];
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

function fields() {
    return Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.style-input-list input, .style-input-list textarea'));
}

for (const [name, component] of [['TInput', TInput], ['TTextarea', TTextarea]] as const) {
    test(`${name} removes a cleared language and becomes untranslated when the last one is cleared`, async () => {
        await loadLanguages();
        const result = renderInput(component, new TranslatedString({
            [Language.Dutch]: 'Hallo',
            [Language.English]: 'Hello',
        }));

        await vi.waitFor(() => expect(fields().map(f => f.value)).toEqual(['Hallo', 'Hello']));
        await userEvent.fill(fields()[1], '');

        await vi.waitFor(() => {
            expect(lastModelValue(result)?.languages).toEqual([Language.Dutch]);
        });
        await result.unmount();

        const single = renderInput(component, new TranslatedString({
            [Language.Dutch]: 'Hallo',
        }));
        await vi.waitFor(() => expect(fields()).toHaveLength(1));
        await userEvent.fill(fields()[0], '');

        await vi.waitFor(() => {
            const value = lastModelValue(single);
            expect(value?.isDefault).toBe(true);
            expect(value?.toString()).toBe('');
        });
        await single.rerender({ modelValue: lastModelValue(single) });
        expect(fields()).toHaveLength(1);
        expect(document.querySelector('.style-input-list .suffix, .textarea-overlay > span')?.textContent?.trim() ?? '').toBe('');
        await single.unmount();
    });
}
