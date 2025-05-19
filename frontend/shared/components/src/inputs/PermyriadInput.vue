<template>
    <FloatInput v-bind="props" v-model="model" suffix="%" />
</template>

<script lang="ts" setup>
import FloatInput from './FloatInput.vue';

const props = withDefaults(defineProps<{
    min?: number | null;
    max?: number | null;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
}>(), {
    min: 0,
    max: 10000,
    placeholder: '',
    disabled: false,
    required: true,
});

const model = defineModel<number | null>('modelValue', {
    required: true,
});
</script>
