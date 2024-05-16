<template>
    <STList>
        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.Equals" @change="onChange" />
            </template>
            <p class="style-title-list">
                Gelijk aan...
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.Equals" ref="input" v-model="filter.value" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="!floatingPoint" placeholder="Vul getal in" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.NotEquals" @change="onChange" />
            </template>
            <p class="style-title-list">
                Niet gelijk aan...
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.NotEquals" ref="input" v-model="filter.value" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="!floatingPoint" placeholder="Vul getal in" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.GreaterThan" @change="onChange" />
            </template>
            <p class="style-title-list">
                Groter dan...
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.GreaterThan" ref="input" v-model="filter.value" :min="null" :max="null" :floating-point="floatingPoint" :stepper="!floatingPoint" placeholder="Vul een getal in" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UINumberFilterMode.LessThan" @change="onChange" />
            </template>
            <p class="style-title-list">
                Kleiner dan...
            </p>

            <component :is="inputComponent" v-if="filter.mode === UINumberFilterMode.LessThan" ref="input" v-model="filter.value" :min="null" :max="null" :floating-point="floatingPoint" :stepper="!floatingPoint" placeholder="Vul een getal in" class="option" />
        </STListItem>
    </STList>
</template>


<script lang="ts" setup>
import { nextTick, ref, computed, markRaw } from 'vue';
import { NumberUIFilter, UINumberFilterMode } from './NumberUIFilter';
import PriceInput from '../inputs/PriceInput.vue';
import NumberInput from '../inputs/NumberInput.vue';

const props = defineProps<{
    filter: NumberUIFilter
}>()

const input = ref<HTMLInputElement | null>(null)
const floatingPoint = computed(() => props.filter.builder.floatingPoint)
const currency = computed(() => props.filter.builder.currency)

async function onChange() {
    await nextTick();
    input.value?.focus()
}

const inputComponent = computed(() => {
    return currency.value ? markRaw(PriceInput) : markRaw(NumberInput)
})
</script>
