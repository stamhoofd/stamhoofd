<template>
    <STList>
        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.Equals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('f664f209-fa11-4816-a8e9-4ff7f7277158') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.Equals" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`149628c3-a9ff-4262-af00-0b59804fd7d6`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.NotEquals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('ce3751a0-69ba-48eb-94a3-b4c498875413') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.NotEquals" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`149628c3-a9ff-4262-af00-0b59804fd7d6`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.GreaterThan" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('5890f004-738f-4d26-b282-de0c39fb1701') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.GreaterThan" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`149628c3-a9ff-4262-af00-0b59804fd7d6`)" />
        </STListItem>

        <STListItem :selectable="true" element-name="label">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="UIDateFilterMode.LessThan" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('f38482ad-88c8-42cf-be01-8f910cb5cf6b') }}
            </p>

            <component :is="DateSelection" v-if="filter.mode === UIDateFilterMode.LessThan" ref="input" v-model="filter.value" :required="true" class="option" :placeholder="$t(`149628c3-a9ff-4262-af00-0b59804fd7d6`)" />
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
