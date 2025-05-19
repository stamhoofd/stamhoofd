<template>
    <FloatInput v-bind="props" v-model="model" :suffix="currency" />
</template>

<script lang="ts" setup generic="T extends number | null">
import FloatInput from './FloatInput.vue';

const props = withDefaults(defineProps<{
    min?: number | null;
    max?: number | null;
    placeholder?: string;
    currency?: string;
    disabled?: boolean;
    required?: boolean;
}>(), {
    min: null,
    max: null,
    placeholder: '',
    currency: 'euro',
    disabled: false,
    required: true,
});

const model = defineModel<T>('modelValue', {
    required: true,
});
</script>
