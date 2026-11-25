import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { TranslatedString } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { userEvent } from 'vitest/browser';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import type { Component } from 'vue';
import { reactive } from 'vue';

import { EditorContext } from './hooks/useEditorContext';
import STInputBox from './STInputBox.vue';
import TInput from './TInput.vue';
import TTextarea from './TTextarea.vue';

function renderInput(component: Component, modelValue: TranslatedString) {
    return render(component, {
        props: {
            title: 'Naam',
            modelValue,
        },
        global: {
            components: {
                STInputBox,
            },
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

function fields() {
    return Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.style-input-list input, .style-input-list textarea'));
}

/**
 * The language label next to each field: a suffix for TInput, an overlay span for TTextarea.
 */
function languageLabels() {
    return Array.from(document.querySelectorAll('.style-input-list .suffix, .textarea-overlay > span'))
        .map(el => el.textContent?.trim() ?? '')
        .filter(text => text.length > 0);
}

beforeEach(async () => {
    await I18nController.loadDefault({
        defaultCountry: Country.Belgium,
        defaultLanguage: Language.Dutch,
        preferredLanguage: Language.Dutch,
        country: Country.Belgium,
        locales: {
            [Country.Belgium]: [Language.Dutch, Language.English],
        },
    });
});

for (const [name, component] of [['TInput', TInput], ['TTextarea', TTextarea]] as const) {
    test(`${name} keeps an emptied field until it loses focus`, async () => {
        const result = renderInput(component, new TranslatedString({
            [Language.Dutch]: 'Hallo',
            [Language.English]: 'Hello',
        }));

        await vi.waitFor(() => expect(fields().map(f => f.value)).toEqual(['Hallo', 'Hello']));
        await userEvent.fill(fields()[1], '');

        await vi.waitFor(() => {
            expect(lastModelValue(result)?.getIfExists(Language.English)).toBe('');
        });

        await result.rerender({ modelValue: lastModelValue(result) });
        expect(fields().map(f => f.value)).toEqual(['Hallo', '']);
        expect(languageLabels()).toEqual(['NL', 'EN']);

        await userEvent.fill(fields()[1], 'Hello again');
        await vi.waitFor(() => {
            expect(lastModelValue(result)?.getIfExists(Language.English)).toBe('Hello again');
        });
    });

    test(`${name} removes a cleared language on blur while another one remains`, async () => {
        const result = renderInput(component, new TranslatedString({
            [Language.Dutch]: 'Hallo',
            [Language.English]: 'Hello',
        }));

        await vi.waitFor(() => expect(fields().map(f => f.value)).toEqual(['Hallo', 'Hello']));
        await userEvent.fill(fields()[1], '');
        fields()[1].blur();

        await vi.waitFor(() => {
            expect(lastModelValue(result)?.languages).toEqual([Language.Dutch]);
        });

        await result.rerender({ modelValue: lastModelValue(result) });
        expect(fields().map(f => f.value)).toEqual(['Hallo']);
        expect(languageLabels()).toEqual(['NL']);
    });

    test(`${name} keeps one untranslated field when the last language is cleared on blur`, async () => {
        const result = renderInput(component, new TranslatedString({
            [Language.Dutch]: 'Hallo',
        }));

        await vi.waitFor(() => expect(fields().map(f => f.value)).toEqual(['Hallo']));
        await userEvent.fill(fields()[0], '');
        fields()[0].blur();

        await vi.waitFor(() => {
            const value = lastModelValue(result);
            expect(value?.isDefault).toBe(true);
            expect(value?.toString()).toBe('');
        });

        await result.rerender({ modelValue: lastModelValue(result) });
        expect(fields().map(f => f.value)).toEqual(['']);
        expect(languageLabels()).toEqual([]);
    });
}
