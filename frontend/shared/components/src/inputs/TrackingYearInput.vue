<template>
    <NumberInputBox :title="$t('%7w')" error-fields="trackingYear" :error-box="errors.errorBox" v-model="trackingYear" :validator="errors.validator" :min="1900" :max="max" >
        <template #right>
            <slot name="right" />
        </template>
    </NumberInputBox>
</template>

<script lang="ts" setup>
import { useErrors } from '../errors/useErrors';
import type { Validator } from '../errors/Validator';
import NumberInputBox from './NumberInputBox.vue';

const props = withDefaults(defineProps<{
    required: boolean;
    validator: Validator | null;
}>(), {
    required: true,
    validator: null,
});

const max = new Date().getFullYear();
const trackingYear = defineModel<number>({ default: new Date().getFullYear() });
const errors = useErrors({ validator: props.validator });
</script>
