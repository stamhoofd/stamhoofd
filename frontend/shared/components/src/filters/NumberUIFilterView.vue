<template>
    <STList>
        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.Equals" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('7a58ad85-ccb7-426f-9882-cec0f413860b') }}
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.Equals" ref="input" v-model="filter.value" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`ffe2c6e5-1c24-4903-9965-7421d3348fa8`)"/>
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.NotEquals" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('a66d8d6b-b23f-4540-b5ae-05a0ecd967cc') }}
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.NotEquals" ref="input" v-model="filter.value" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`ffe2c6e5-1c24-4903-9965-7421d3348fa8`)"/>
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.GreaterThan" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('5d7c4091-4078-468f-96db-a626e72d4c25') }}
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.GreaterThan" ref="input" v-model="filter.value" :min="null" :max="null" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`5dc12f69-bfaa-4a1c-82fb-59735e72aafe`)"/>
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.LessThan" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('c89f00c0-945d-4a9a-9120-93ac81f5d3e3') }}
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.LessThan" ref="input" v-model="filter.value" :min="null" :max="null" :floating-point="floatingPoint" :stepper="!floatingPoint" class="option" :placeholder="$t(`5dc12f69-bfaa-4a1c-82fb-59735e72aafe`)"/>
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
