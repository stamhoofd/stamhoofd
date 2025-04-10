<template>
    <STList>
        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.Equals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('Gelijk aan...') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.Equals" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`Vul datum in`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.NotEquals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('Niet gelijk aan...') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.NotEquals" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`Vul datum in`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.GreaterThan" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('Groter dan...') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.GreaterThan" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`Vul datum in`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.LessThan" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('Kleiner dan...') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.LessThan" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`Vul datum in`)" />
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
