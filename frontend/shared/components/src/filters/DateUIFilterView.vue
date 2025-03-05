<template>
    <STList>
        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.Equals" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('7a58ad85-ccb7-426f-9882-cec0f413860b') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.Equals" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`7fcf2dd1-43af-4426-813e-d1987ef88e11`)"/>
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.NotEquals" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('a66d8d6b-b23f-4540-b5ae-05a0ecd967cc') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.NotEquals" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`7fcf2dd1-43af-4426-813e-d1987ef88e11`)"/>
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.GreaterThan" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('5d7c4091-4078-468f-96db-a626e72d4c25') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.GreaterThan" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`7fcf2dd1-43af-4426-813e-d1987ef88e11`)"/>
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.LessThan" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('c89f00c0-945d-4a9a-9120-93ac81f5d3e3') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.LessThan" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`7fcf2dd1-43af-4426-813e-d1987ef88e11`)"/>
        </STListItem>
    </STList>
</template>

<script lang="ts" setup>
import { nextTick, ref } from 'vue';
import DateSelection from '../inputs/DateSelection.vue';
import { DateUIFilter, UIDateFilterMode } from './DateUIFilter';

defineProps<{
    filter: DateUIFilter;
}>();

const input = ref<HTMLInputElement | null>(null);

async function onChange() {
    await nextTick();
    input.value?.focus?.();
}
</script>
