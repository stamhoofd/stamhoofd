<template>
    <component :is="inputComponent" v-model="filter.value" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`%bU`)" />
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import DeprecatedNumberInput from '../inputs/DeprecatedNumberInput.vue';
import PriceInput from '../inputs/PriceInput.vue';
import TimeMinutesInput from '../inputs/TimeMinutesInput.vue';
import type { NumberUIFilter } from './NumberUIFilter';
import { NumberFilterFormat } from './NumberUIFilter';

const props = defineProps<{
    filter: NumberUIFilter;
}>();

const type = computed(() => props.filter.builder.type);
const floatingPoint = computed(() => props.filter.builder.floatingPoint);

const inputComponent = computed(() => {
    switch (type.value) {
        case NumberFilterFormat.Number: return markRaw(DeprecatedNumberInput);
        case NumberFilterFormat.Currency: return markRaw(PriceInput);
        case NumberFilterFormat.TimeMinutes: return markRaw(TimeMinutesInput);
        default: return markRaw(DeprecatedNumberInput);
    }
});
</script>
