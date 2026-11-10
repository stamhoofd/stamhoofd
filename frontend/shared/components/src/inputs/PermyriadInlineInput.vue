<template>
    <FloatInlineInput v-bind="props" v-model="model" suffix="%" :fraction-digits="2" />
</template>

<script lang="ts" setup generic="T extends number | null">
import FloatInlineInput from './FloatInlineInput.vue';

const props = withDefaults(defineProps<{
    min?: number | null;
    max?: number | null;
    disabled?: boolean;
    label?: string | null;
}>(), {
    min: 0,
    max: 10000,
    disabled: false,
    label: null,
});

const model = defineModel<T>('modelValue', {
    required: true,
});
</script>
