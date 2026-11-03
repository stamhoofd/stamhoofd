<template>
    <STInputBox :title="title">
        <div ref="root" class="style-input-list">
            <div
                v-for="language of listedLanguages"
                :key="language ?? 'def'"
                class="long-text-input"
            >
                <textarea
                    autocomplete="off"
                    data-1p-ignore
                    rows="1"
                    class="input"
                    :placeholder="placeholderFor(language)"
                    :value="getForLanguage(language)"
                    @input="onInput($event, language)"
                    @keydown.enter.prevent
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
import type { TranslatedLongText } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';
import { registerTranslateableComponent } from './hooks/useEditorContext';
import STInputBox from './STInputBox.vue';
import TInputButton from './TInputButton.vue';

const value = defineModel<TranslatedLongText>({ required: true });

const { hasLanguages } = useSwitchLanguage();
registerTranslateableComponent(value);

const props = withDefaults(
    defineProps<{
        title: string;
        placeholder?: string | TranslatedLongText;
    }>(), {
        title: '',
        placeholder: '',
    },
);

const root = useTemplateRef<HTMLElement>('root');

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

/**
 * No scrolling, because the whole description has to be readable while it is edited
 */
function grow(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function onInput(event: Event, language: Language | null) {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    grow(textarea);
    setForLanguage(textarea.value, language);
}

function growAll() {
    for (const textarea of root.value?.querySelectorAll('textarea') ?? []) {
        grow(textarea);
    }
}

onMounted(growAll);

// A language added later starts at one row
watch(listedLanguages, () => void nextTick(growAll));
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.long-text-input {
    position: relative;

    > textarea {
        resize: none;
        overflow: hidden;
    }

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
