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
                                    !editorContext.isComplete(lang) ? $t('21b3891d-7c0e-49ca-ae35-d77d54e9f0c3') : undefined
                                )
                            : $t('2f5d5e2d-cc3b-4cf6-8f4e-97b72a106163')),
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
