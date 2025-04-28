<template>
    <STInputBox :title="title">
        <textarea class="input" type="text" autocomplete="off" :placeholder="placeholder" />

        <template #right>
            <TInputButton v-model="value" />
        </template>
    </STInputBox>
</template>

<script setup lang="ts">
import { TranslatedString } from '@stamhoofd/structures';
import { registerTranslateableComponent } from './hooks/useEditorContext';
import TInputButton from './TInputButton.vue';

const value = defineModel<TranslatedString>({ required: true });
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

</script>
