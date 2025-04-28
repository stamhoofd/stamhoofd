<template>
    <STInputBox :title="title">
        <div class="style-input-list">
            <div
                v-for="language of listedLanguages"
                :key="language ?? 'def'" class="textarea-overlay"
            >
                <textarea
                    autocomplete="off"
                    data-1p-ignore
                    class="input"
                    :placeholder="placeholder"
                    :value="getForLanguage(language)"
                    @input="setForLanguage(($event.currentTarget as HTMLTextAreaElement).value, language)"
                />
                <span v-if="language">
                    {{ language.toUpperCase() }}
                </span>
            </div>
        </div>

        <template #right>
            <TInputButton v-model="value" />
        </template>
    </STInputBox>
</template>

<script setup lang="ts">
import { Language, TranslatedString } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEditorLanguage } from './hooks/useEditorLanguage';
import { registerTranslateableComponent } from './hooks/useEditorContext';
import TInputButton from './TInputButton.vue';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';
import { I18nController } from '@stamhoofd/frontend-i18n';
import SuffixInput from './SuffixInput.vue';

const value = defineModel<TranslatedString>({ required: true });

if (typeof value.value === 'string') {
    throw new Error('TInput must be used with a TranslatedString');
}

const editorLanguage = useEditorLanguage();
const { hasLanguages } = useSwitchLanguage();
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

const listedLanguages = computed(() => {
    if (!hasLanguages || value.value.isDefault) {
        return [null];
    }
    const l = value.value.languages;

    // Sort by languages order
    return I18nController.shared.availableLanguages.filter(ll => l.includes(ll));
});

function getForLanguage(lang: Language | null) {
    if (lang === null) {
        return value.value.toString();
    }
    return value.value.getIfExists(lang) ?? '';
}

function setForLanguage(val: string, lang: Language | null) {
    if (lang === null || !hasLanguages) {
        // Just set as string without defining the editor language
        value.value = value.value.patch(val);
        return;
    }

    value.value = value.value.patch({
        [lang]: val || null,
    });
}

const textValue = computed({
    get: () => getForLanguage(editorLanguage.value ?? Language.English),
    set: (val: string) => {
        setForLanguage(val, editorLanguage.value ?? Language.English);
    },
});
</script>
