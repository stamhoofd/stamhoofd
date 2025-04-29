<template>
    <template v-if="hasLanguages">
        <button class="button icon language small gray" type="button" @click="showMenu" />
    </template>
</template>

<script setup lang="ts">
import { LanguageHelper, TranslatedString } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEditorLanguage } from './hooks/useEditorLanguage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';

const value = defineModel<TranslatedString>({ required: true });
const editorLanguage = useEditorLanguage();
const { hasLanguages } = useSwitchLanguage();
const isDefault = computed(() => {
    return typeof value.value.translations === 'string';
});

const isMissing = computed(() => {
    return editorLanguage.value && (!value.value.getIfExists(editorLanguage.value) && value.value.get(editorLanguage.value));
});

async function showAll() {
    editorLanguage.value = null;
}

async function showMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('04e77650-18ef-40a1-942f-bf755e1ca4dc'),
                selected: value.value.isDefault,
                action: () => {
                    value.value = value.value.patch(value.value.toString());
                },
            }),
        ],
        I18nController.shared.availableLanguages.map(lang => new ContextMenuItem({
            name: LanguageHelper.getName(lang),
            selected: value.value.languages.includes(lang),
            action: () => {
                const included = value.value.languages.includes(lang);
                if (!included) {
                    if (value.value.isDefault) {
                        value.value = new TranslatedString({
                            [lang]: value.value.toString(),
                        });
                    }
                    else {
                        value.value = value.value.patch({
                            [lang]: value.value.getIfExists(lang) ?? '',
                        });
                    }
                }
                else {
                    if (value.value.languages.length > 1) {
                        // Remove the language
                        value.value = value.value.patch({
                            [lang]: null,
                        });
                    }
                    else {
                        // Set as untranslated
                        value.value = new TranslatedString(value.value.toString());
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
