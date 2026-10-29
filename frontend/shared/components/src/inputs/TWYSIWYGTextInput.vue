<template>
    <STInputBox :title="title">
        <div class="style-input-list">
            <div
                v-for="language of listedLanguages"
                :key="language ?? 'def'" class="t-wysiwyg-text-input"
            >
                <WYSIWYGTextInput
                    :model-value="getForLanguage(language)"
                    :placeholder="typeof placeholder === 'string' ? placeholder : (language ? placeholder.get(language) : placeholder.toString()) ?? ''"
                    @update:model-value="setForLanguage($event, language)"
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
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { TranslatedRichText, TranslatedString } from '@stamhoofd/structures';
import { RichText } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import { computed } from 'vue';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';
import { registerTranslateableComponent } from './hooks/useEditorContext';
import STInputBox from './STInputBox.vue';
import TInputButton from './TInputButton.vue';
import WYSIWYGTextInput from './WYSIWYGTextInput.vue';

const value = defineModel<TranslatedRichText>({ required: true });

const { hasLanguages } = useSwitchLanguage();
registerTranslateableComponent(value);

withDefaults(
    defineProps<{
        title: string;
        placeholder?: string | TranslatedString;
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

function getForLanguage(lang: Language | null): RichText {
    if (lang === null) {
        return value.value.toRichText();
    }
    return value.value.getIfExists(lang) ?? RichText.create({});
}

function setForLanguage(val: RichText, lang: Language | null) {
    if (lang === null || !hasLanguages) {
        // Just set without defining the editor language
        value.value = value.value.patch(val);
        return;
    }

    if (isEmpty(val)) {
        if (value.value.languages.length <= 1) {
            // Clearing the last language leaves nothing to translate: back to an untranslated value, like TInputButton does
            value.value = value.value.patch(RichText.create({}));
            return;
        }

        // Remove a cleared language so readers fall back to another language, like TInput does
        value.value = value.value.patch({
            [lang]: null,
        });
        return;
    }

    value.value = value.value.patch({
        [lang]: val,
    });
}

function isEmpty(val: RichText) {
    return val.text === '' && (val.html === '' || val.html === '<p></p>');
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.t-wysiwyg-text-input {
    position: relative;

    > span {
        position: absolute;
        right: 10px;
        top: 10px;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
        @extend %style-input;
        color: $color-dark;
        opacity: 0.5;
    }
}
</style>
