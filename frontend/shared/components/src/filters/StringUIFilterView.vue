<template>
    <STList>
        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Equals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('%bf') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.Equals" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`%bl`)">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotEquals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('%bg') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.NotEquals" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`%bl`)">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Contains" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('%bh') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.Contains" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`%bl`)">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotContains" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('%bi') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.NotContains" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`%bl`)">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Empty" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('%bj') }}
            </p>
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotEmpty" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('%bk') }}
            </p>
        </STListItem>
    </STList>
</template>

<script lang="ts" setup>
import { nextTick, useTemplateRef } from 'vue';

import Radio from '../inputs/Radio.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { StringFilterMode } from './StringFilterMode';

defineProps<{
    filter: {
        id: string;
        mode: StringFilterMode;
        value: string;
    };
}>();

const input = useTemplateRef<HTMLInputElement>('input');

async function onChange() {
    await nextTick();
    input.value?.focus();
}
</script>
