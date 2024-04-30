<template>
    <STList>
        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Contains" @change="onChange" />
            </template>
            <p class="style-title-list">
                Bevat...
            </p>
            <input v-if="filter.mode === StringFilterMode.Contains" ref="input" v-model="filter.value" placeholder="Vul tekst in" class="input option">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotContains" @change="onChange" />
            </template>
            <p class="style-title-list">
                Bevat niet...
            </p>
            <input v-if="filter.mode === StringFilterMode.NotContains" ref="input" v-model="filter.value" placeholder="Vul tekst in" class="input option">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Equals" @change="onChange" />
            </template>
            <p class="style-title-list">
                Is gelijk aan...
            </p>
            <input v-if="filter.mode === StringFilterMode.Equals" ref="input" v-model="filter.value" placeholder="Vul tekst in" class="input option">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotEquals" @change="onChange" />
            </template>
            <p class="style-title-list">
                Is niet gelijk aan...
            </p>
            <input v-if="filter.mode === StringFilterMode.NotEquals" ref="input" v-model="filter.value" placeholder="Vul tekst in" class="input option">
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.Empty" @change="onChange" />
            </template>
            <p class="style-title-list">
                Is leeg
            </p>
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <template #left>
                <Radio v-model="filter.mode" :name="filter.id" :value="StringFilterMode.NotEmpty" @change="onChange" />
            </template>
            <p class="style-title-list">
                Is niet leeg
            </p>
        </STListItem>
    </STList>
</template>


<script lang="ts">
import { StringFilter, StringFilterMode } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "vue-property-decorator";

import Radio from "../../inputs/Radio.vue";
import STList from "../../layout/STList.vue";
import STListItem from "../../layout/STListItem.vue";

@Component({
    components: {
        STListItem,
        STList,
        Radio
    }
})
export default class StringFilterView extends Vue {
    @Prop({ required: true }) 
        filter: StringFilter<any>

    get StringFilterMode() {
        return StringFilterMode
    }

    async onChange() {
        await this.$nextTick();
        console.log("onchange");
        (this.$refs["input"] as any).focus()
    }

}
</script>