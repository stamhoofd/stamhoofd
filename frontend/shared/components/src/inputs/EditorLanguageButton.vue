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
                name: 'Taal',
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
