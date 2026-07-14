<template>
    <!-- Also visible when translations exist while the platform has a single language: they should remain manageable -->
    <template v-if="hasLanguages || languages.length > 0">
        <button class="button text small gray" type="button" :disabled="disabled" data-testid="email-language-button" @click="showMenu">
            <span class="icon language small" />
            <span v-if="modelValue" class="style-tag">{{ modelValue.toUpperCase() }}</span>
        </button>
    </template>
</template>

<script setup lang="ts">
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { LanguageHelper } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';

const props = withDefaults(defineProps<{
    /**
     * Languages for which a translation exists
     */
    languages: Language[];
    disabled?: boolean;
}>(), {
    disabled: false,
});

const emit = defineEmits<{
    add: [language: Language];
    remove: [language: Language];
}>();

/**
 * The language that is currently being edited (null = the default content)
 */
const modelValue = defineModel<Language | null>({ required: true });
const { hasLanguages } = useSwitchLanguage();

async function showMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('Standaardtekst'),
                description: $t('Gebruikt voor alle talen zonder vertaling'),
                selected: modelValue.value === null,
                action: () => {
                    modelValue.value = null;
                },
            }),
        ],
        [...new Set([...I18nController.shared.availableLanguages, ...props.languages])].map((language) => {
            const exists = props.languages.includes(language);
            const isCurrent = modelValue.value === language;

            return new ContextMenuItem({
                name: LanguageHelper.getName(language),
                selected: isCurrent,
                icon: exists && !isCurrent ? 'success' : null,
                description: !exists ? $t('Vertaling toevoegen') : (isCurrent ? $t('Klik om deze vertaling te verwijderen') : null) ?? undefined,
                action: () => {
                    if (!exists) {
                        emit('add', language);
                        return;
                    }
                    if (!isCurrent) {
                        modelValue.value = language;
                        return;
                    }
                    emit('remove', language);
                },
            });
        }),
    ]);
    await menu.show({
        button: event.currentTarget as HTMLButtonElement,
    });
}
</script>
