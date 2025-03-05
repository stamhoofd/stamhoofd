<template>
    <STList>
        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Equals" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('fc83653e-c58c-44bc-9e02-a8d5ebbb1789') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.Equals" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`7017ffc1-768e-4854-b96d-230df002f115`)"></STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotEquals" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('f2d75d4a-e194-429a-9165-fcbe4875bd31') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.NotEquals" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`7017ffc1-768e-4854-b96d-230df002f115`)"></STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Contains" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('bf6d50fd-da97-47b7-8dba-592184c048a3') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.Contains" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`7017ffc1-768e-4854-b96d-230df002f115`)"></STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotContains" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('84e11f62-f2da-4469-8cb4-dff65866e22b') }}
            </p>
            <input v-if="filter.mode === StringFilterMode.NotContains" ref="input" v-model="filter.value" class="input option" :placeholder="$t(`7017ffc1-768e-4854-b96d-230df002f115`)"></STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Empty" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('c1511c60-1cbd-4333-9878-0ef354d5ed8a') }}
            </p>
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotEmpty" @change="onChange"/>
            </template>
            <p class="style-title-list">
                {{ $t('8540004a-fc52-4371-8123-c4e347037646') }}
            </p>
        </STListItem>
    </STList>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import Radio from "../inputs/Radio.vue";
import STList from "../layout/STList.vue";
import STListItem from "../layout/STListItem.vue";
import { StringFilterMode, StringUIFilter } from './StringUIFilter';

@Component({
    components: {
        STListItem,
        STList,
        Radio
    }
})
export default class StringUIFilterView extends Mixins(NavigationMixin) {
    @Prop({ required: true }) 
        filter: StringUIFilter

    get StringFilterMode() {
        return StringFilterMode
    }

    async onChange() {
        await this.$nextTick();
        (this.$refs["input"] as any).focus()
    }

}
</script>
