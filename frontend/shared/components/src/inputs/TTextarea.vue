<template>
    <STInputBox :title="title">
        <textarea v-model="textValue" class="input" type="text" autocomplete="off" :placeholder="placeholder" />

        <template v-if="hasLanguages" #right>
            <span v-if="isMissing" v-tooltip="$t('Dit is leeg maar werd wel ingevuld in een andere taal')" class="icon small error red" />
            <button class="button icons" type="button" @click="showMenu">
                <span class="icon language small gray" />
                <span class="icon arrow-down-small" />
            </button>
        </template>
    </STInputBox>
</template>

<script setup lang="ts">
import { LanguageHelper, TranslatedString } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEditorLanguage } from './hooks/useEditorLanguage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';
import { registerTranslateableComponent } from './hooks/useEditorContext';

const value = defineModel<TranslatedString>({ required: true });
const editorLanguage = useEditorLanguage();
const { hasLanguages } = useSwitchLanguage();
const isMissing = computed(() => {
    return !value.value.getIfExists(editorLanguage.value) && value.value.get(editorLanguage.value);
});
registerTranslateableComponent(value);

withDefaults(
    defineProps<{
        title: string;
        placeholder?: string;
    }>(), {
        title: '',
        placeholder: '',
    },
);

const textValue = computed({
    get: () => value.value.getIfExists(editorLanguage.value) ?? '',
    set: (val: string) => {
        value.value = value.value.patch({
            [editorLanguage.value]: val || null,
        });
    },
});

async function showMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('Verwijder vertaling'),
                disabled: !value.value.getIfExists(editorLanguage.value) || Object.keys(value.value.translations).length <= 1,
                icon: 'trash',
                action: () => {
                    value.value = value.value.patch({
                        [editorLanguage.value]: null,
                    });
                },
            }),
            new ContextMenuItem({
                name: $t('Neem vertaling over'),
                disabled: !isMissing.value,
                icon: 'copy',
                action: () => {
                    value.value = value.value.patch({
                        [editorLanguage.value]: value.value.get(editorLanguage.value),
                    });
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t('Taal'),
                description: LanguageHelper.getName(editorLanguage.value),
                childMenu: new ContextMenu([
                    I18nController.shared.availableLanguages.map(lang => new ContextMenuItem({
                        name: LanguageHelper.getName(lang),
                        selected: lang === editorLanguage.value,
                        action: () => {
                            editorLanguage.value = lang;
                        },
                    })),
                ]),
            }),
        ],
    ]);
    await menu.show({
        button: event.currentTarget as HTMLButtonElement,
    });
}

</script>
