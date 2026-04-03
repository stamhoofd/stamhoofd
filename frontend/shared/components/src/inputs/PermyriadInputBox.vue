<template>
    <FloatInputBox v-bind="props" v-model="model" suffix="%">
        <template #default>
            <slot />
        </template>
    </FloatInputBox>
</template>

<script lang="ts" setup generic="T extends number | null">
import type { ErrorBox } from '../errors/ErrorBox';
import type { Validator } from '../errors/Validator';
import FloatInputBox from './FloatInputBox.vue';

const props = withDefaults(defineProps<{
    title?: string;
    errorFields?: string;
    class?: string | null;
    validator: Validator | null;
    errorBox?: ErrorBox | null;

    min?: number | null;
    max?: number | null;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
}>(), {
    title: undefined,
    errorFields: 'number',
    class: null,
    errorBox: null,
    min: 0,
    max: 10000,
    placeholder: '',
    disabled: false,
    required: true,
});

const model = defineModel<number | null>({ default: null });
</script>
