<template>
    <component :is="inputComponent" v-model="filter.value" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`f820fe9e-aee2-4e08-9fe7-8b531280f371`)" />
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import NumberInput from '../inputs/NumberInput.vue';
import PriceInput from '../inputs/PriceInput.vue';
import TimeMinutesInput from '../inputs/TimeMinutesInput.vue';
import { NumberFilterFormat, NumberUIFilter } from './NumberUIFilter';

const props = defineProps<{
    filter: NumberUIFilter;
}>();

const type = computed(() => props.filter.builder.type);
const floatingPoint = computed(() => props.filter.builder.floatingPoint);

const inputComponent = computed(() => {
    switch (type.value) {
        case NumberFilterFormat.Number: return markRaw(NumberInput);
        case NumberFilterFormat.Currency: return markRaw(PriceInput);
        case NumberFilterFormat.TimeMinutes: return markRaw(TimeMinutesInput);
        default: return markRaw(NumberInput);
    }
});
</script>
