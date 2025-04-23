<template>
    <STInputBox :title="title">
        <input v-model="textValue" class="input" type="text" autocomplete="off" :placeholder="placeholder">

        <template #right>
            <TInputButton v-model="value" />
        </template>
    </STInputBox>
</template>

<script setup lang="ts">
import { TranslatedString } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEditorLanguage } from './hooks/useEditorLanguage';
import { registerTranslateableComponent } from './hooks/useEditorContext';
import TInputButton from './TInputButton.vue';

const value = defineModel<TranslatedString>({ required: true });
const editorLanguage = useEditorLanguage();
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
</script>
