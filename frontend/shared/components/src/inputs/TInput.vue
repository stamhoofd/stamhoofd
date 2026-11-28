<template>
    <STInputBox :title="title">
        <div class="style-input-list">
            <SuffixInput
                v-for="(language, index) of listedLanguages"
                :key="language ?? ''"
                type="text"
                autocomplete="off"
                data-1p-ignore
                :placeholder="typeof placeholder === 'string' ? placeholder : (language ? placeholder.get(language) : placeholder.toString()) ?? ''"
                :model-value="getForLanguage(language)"
                :suffix="language ? language.toUpperCase() : ''"
                :autofocus="autofocus && index === 0 ? true: undefined"
                @update:model-value="setForLanguage($event, language)"
                @blur="dropEmptyLanguage(language)"
            />
        </div>

        <template #right>
            <TInputButton v-model="value" />
        </template>
    </STInputBox>
</template>

<script setup lang="ts">
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { TranslatedString } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { computed } from 'vue';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';
import { registerTranslateableComponent } from './hooks/useEditorContext';
import SuffixInput from './SuffixInput.vue';
import TInputButton from './TInputButton.vue';
const value = defineModel<TranslatedString>({ required: true });

if (typeof value.value === 'string') {
    throw new Error('TInput must be used with a TranslatedString');
}

const { hasLanguages } = useSwitchLanguage();
registerTranslateableComponent(value);

const editedLanguages = new Set<Language>();

withDefaults(
    defineProps<{
        title: string;
        placeholder?: string | TranslatedString;
        autofocus?: boolean;
    }>(), {
        title: '',
        placeholder: '',
        autofocus: false,
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

    // An emptied language is only dropped on blur, so its field stays while retyping
    editedLanguages.add(lang);
    value.value = value.value.patch({
        [lang]: val,
    });
}

function dropEmptyLanguage(lang: Language | null) {
    if (lang === null || !hasLanguages) {
        return;
    }

    // Only a language the user emptied themselves is dropped, not one TInputButton just added
    const wasEdited = editedLanguages.delete(lang);
    if (!wasEdited || value.value.getIfExists(lang)) {
        return;
    }

    const patched = value.value.patch({
        [lang]: null,
    });

    // Nothing left to translate, so drop back to an untranslated value like TInputButton does
    value.value = patched.languages.length === 0 ? value.value.patch('') : patched;
}
</script>
