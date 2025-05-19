<template>
    <FloatInput v-bind="props" v-model="model" :suffix="currency" />
</template>

<script lang="ts" setup>
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

const model = defineModel<number | null>('modelValue', {
    required: true,
});
</script>
