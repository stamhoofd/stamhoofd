<template>
    <STInputBox :title="title">
        <div class="style-input-list">
            <SuffixInput
                v-for="(language, index) of listedLanguages"
                :key="language ?? ''"
                type="text"
                autocomplete="off"
                data-1p-ignore
                :placeholder="placeholderFor(language)"
                :model-value="getForLanguage(language)"
                :suffix="language ? language.toUpperCase() : ''"
                :autofocus="autofocus && index === 0 ? true : undefined"
                @update:model-value="setForLanguage($event, language)"
            />
        </div>

        <template #right>
            <TInputButton v-model="value" />
        </template>
    </STInputBox>
</template>

<script setup lang="ts">
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { TranslatedText } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import { computed } from 'vue';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';
import { registerTranslateableComponent } from './hooks/useEditorContext';
import STInputBox from './STInputBox.vue';
import SuffixInput from './SuffixInput.vue';
import TInputButton from './TInputButton.vue';

const value = defineModel<TranslatedText>({ required: true });

const { hasLanguages } = useSwitchLanguage();
registerTranslateableComponent(value);

const props = withDefaults(
    defineProps<{
        title: string;
        placeholder?: string | TranslatedText;
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

function placeholderFor(language: Language | null) {
    if (typeof props.placeholder === 'string') {
        return props.placeholder;
    }
    return (language ? props.placeholder.get(language) : props.placeholder.toString()) ?? '';
}

function getForLanguage(language: Language | null) {
    if (language === null) {
        return value.value.toString();
    }
    return value.value.getIfExists(language) ?? '';
}

function setForLanguage(val: string, language: Language | null) {
    if (language === null || !hasLanguages) {
        // Just set as string without defining the editor language
        value.value = value.value.patch(val);
        return;
    }

    value.value = value.value.patch({
        [language]: val || null,
    });
}
</script>
