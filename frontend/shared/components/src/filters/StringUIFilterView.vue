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

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

import Radio from '../inputs/Radio.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import type { StringUIFilter } from './StringUIFilter';
import { StringFilterMode } from './StringUIFilter';

@Component({
    components: {
        STListItem,
        STList,
        Radio,
    },
})
export default class StringUIFilterView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    filter: StringUIFilter;

    get StringFilterMode() {
        return StringFilterMode;
    }

    async onChange() {
        await this.$nextTick();
        (this.$refs['input'] as any).focus();
    }
}
</script>
