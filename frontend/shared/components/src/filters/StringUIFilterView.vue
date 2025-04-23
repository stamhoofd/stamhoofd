<template>
    <STList>
        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Equals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('f9ed62e7-b956-41d0-b256-66cbe5b44ee9') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.Equals" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`23c81649-6973-458f-b275-d1581b541e02`)">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotEquals" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('2760ef35-629a-4770-9203-70cdebd91efc') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.NotEquals" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`23c81649-6973-458f-b275-d1581b541e02`)">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Contains" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('7f2a8893-7982-4ea5-8f5d-e9de0cffc6d9') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.Contains" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`23c81649-6973-458f-b275-d1581b541e02`)">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotContains" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('88614c1b-47ee-4596-9679-e960238fe217') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.NotContains" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`23c81649-6973-458f-b275-d1581b541e02`)">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Empty" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('f6c53ee9-9b15-4f33-a617-ac3a3d2ac8d0') }}
            </p>
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotEmpty" @change="onChange" />
            </template>
            <p class="style-title-list">
                {{ $t('b05a9993-9743-4cb3-99f1-6deb5a44b7f5') }}
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
import { StringFilterMode, StringUIFilter } from './StringUIFilter';

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
