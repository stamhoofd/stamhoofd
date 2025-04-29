<template>
    <button v-if="enabled && hasLanguages" class="button icons" type="button" @click="showMenu">
        <span class="icon language gray" />
        <span class="style-tag">
            {{ editorLanguage }}
        </span>
        <span class="icon arrow-down-small" />
    </button>
</template>

<script setup lang="ts">
import { LanguageHelper } from '@stamhoofd/structures';
import { useEditorLanguage } from './hooks/useEditorLanguage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';
import { useEditorContext } from './hooks/useEditorContext';
import { computed } from 'vue';

const editorLanguage = useEditorLanguage();
const { hasLanguages } = useSwitchLanguage();
const editorContext = useEditorContext();
const enabled = computed(() => editorContext.enabled);

async function showMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('cf9f3bc1-51d7-438b-832c-8757ee79e0d4'),
                description: !editorLanguage.value ? $t('c9a10eba-c0b7-492e-b6fa-07ec6ac074f7') : LanguageHelper.getName(editorLanguage.value),
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: $t('c9a10eba-c0b7-492e-b6fa-07ec6ac074f7'),
                            selected: editorLanguage.value === null,
                            action: () => {
                                editorLanguage.value = null;
                            },
                        }),
                    ],
                    I18nController.shared.availableLanguages.map(lang => new ContextMenuItem({
                        name: LanguageHelper.getName(lang),
                        selected: lang === editorLanguage.value,
                        description: (editorContext.hasLanguage(lang)
                            ? (
                                    !editorContext.isComplete(lang) ? $t('edcbd633-f0f9-4e7f-97bc-e91a6eb1fff0') : undefined
                                )
                            : $t('f910a622-522a-4507-89a1-8cae473ea043')),
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
