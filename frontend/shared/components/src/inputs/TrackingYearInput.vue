<template>
    <STInputBox :title="$t('%7w')" error-fields="trackingYear" :error-box="errors.errorBox">
        <NumberInput v-model="trackingYear" :title="$t('%7w')" :validator="errors.validator" :min="1900" :max="max" />
        <template #right>
            <slot name="right" />
        </template>
    </STInputBox>
</template>

<script lang="ts" setup>
import { useErrors } from '../errors/useErrors';
import type { Validator } from '../errors/Validator';
import NumberInput from './NumberInput.vue';
import STInputBox from './STInputBox.vue';

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
