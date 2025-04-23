<template>
    <STList>
        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.Equals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('f664f209-fa11-4816-a8e9-4ff7f7277158') }}
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.Equals" ref="input" v-model="filter.value" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`f820fe9e-aee2-4e08-9fe7-8b531280f371`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.NotEquals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('ce3751a0-69ba-48eb-94a3-b4c498875413') }}
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.NotEquals" ref="input" v-model="filter.value" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`f820fe9e-aee2-4e08-9fe7-8b531280f371`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.GreaterThan" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('5890f004-738f-4d26-b282-de0c39fb1701') }}
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.GreaterThan" ref="input" v-model="filter.value" :min="null" :max="null" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`5eda5dc0-3987-4244-8d6c-a65fa9bbe4ea`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.LessThan" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('f38482ad-88c8-42cf-be01-8f910cb5cf6b') }}
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.LessThan" ref="input" v-model="filter.value" :min="null" :max="null" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`5eda5dc0-3987-4244-8d6c-a65fa9bbe4ea`)" />
        </STListItem>
    </STList>
</template>

<script lang="ts" setup>
import { computed, markRaw, nextTick, ref } from 'vue';
import NumberInput from '../inputs/NumberInput.vue';
import PriceInput from '../inputs/PriceInput.vue';
import TimeMinutesInput from '../inputs/TimeMinutesInput.vue';
import { NumberFilterFormat, NumberUIFilter, UINumberFilterMode } from './NumberUIFilter';

const props = defineProps<{
    filter: NumberUIFilter;
}>();

const type = computed(() => props.filter.builder.type);
const input = ref<HTMLInputElement | null>(null);
const floatingPoint = computed(() => props.filter.builder.floatingPoint);

async function onChange() {
    await nextTick();
    input.value?.focus();
}

const inputComponent = computed(() => {
    switch (type.value) {
        case NumberFilterFormat.Number: return markRaw(NumberInput);
        case NumberFilterFormat.Currency: return markRaw(PriceInput);
        case NumberFilterFormat.TimeMinutes: return markRaw(TimeMinutesInput);
        default: return markRaw(NumberInput);
    }
});
</script>
