<template>
    <template v-if="hasLanguages">
        <button class="button icon translate small gray" type="button" @click="showMenu" />
    </template>
</template>

<script setup lang="ts">
import { LanguageHelper, RichText, TranslatedRichText, TranslatedString } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import type { TranslateableValue } from './hooks/useEditorContext';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';

const value = defineModel<TranslateableValue>({ required: true });
const { hasLanguages } = useSwitchLanguage();

function untranslated(): TranslateableValue {
    if (value.value instanceof TranslatedRichText) {
        return new TranslatedRichText(value.value.toRichText());
    }
    return new TranslatedString(value.value.toString());
}

function withLanguage(lang: Language): TranslateableValue {
    // On an untranslated value, getIfExists returns the untranslated content and patch converts it into a language map
    const v = value.value;
    if (v instanceof TranslatedRichText) {
        return v.patch({ [lang]: v.getIfExists(lang) ?? RichText.create({}) });
    }
    return v.patch({ [lang]: v.getIfExists(lang) ?? '' });
}

async function showMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('%14n'),
                selected: value.value.isDefault,
                action: () => {
                    value.value = untranslated();
                },
            }),
        ],
        I18nController.shared.availableLanguages.map(lang => new ContextMenuItem({
            name: LanguageHelper.getName(lang),
            selected: value.value.languages.includes(lang),
            action: () => {
                const included = value.value.languages.includes(lang);
                if (!included) {
                    value.value = withLanguage(lang);
                } else {
                    if (value.value.languages.length > 1) {
                        // Remove the language
                        value.value = value.value.patch({
                            [lang]: null,
                        });
                    } else {
                        // Set as untranslated
                        value.value = untranslated();
                    }
                }
                return false; // Do not close
            },
        })),
    ]);
    await menu.show({
        button: event.currentTarget as HTMLButtonElement,
    });
}

</script>
