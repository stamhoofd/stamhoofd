<template>
    <STList>
        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="NumberFilterMode.Equals" @change="onChange" />
            <p class="style-title-list">
                Gelijk aan...
            </p>
            <NumberInput v-if="filter.mode === NumberFilterMode.Equals" ref="input" v-model="filter.start" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="floatingPoint" placeholder="Vul getal in" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="NumberFilterMode.NotEquals" @change="onChange" />
            <p class="style-title-list">
                Niet gelijk aan...
            </p>

            <NumberInput v-if="filter.mode === NumberFilterMode.NotEquals" ref="input" v-model="filter.start" :min="null" :max="null" :required="true" :floating-point="floatingPoint" :stepper="floatingPoint" placeholder="Vul getal in" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="NumberFilterMode.Between" @change="onChange" />
            <p class="style-title-list">
                Tussen...
            </p>

            <NumberInput v-if="filter.mode === NumberFilterMode.Between" ref="input" v-model="filter.start" :min="null" :max="null" :required="filter.end === null" :floating-point="floatingPoint" :stepper="floatingPoint" placeholder="Van" class="option" />
            <NumberInput v-if="filter.mode === NumberFilterMode.Between" v-model="filter.end" :min="null" :max="null" :required="filter.start === null" :floating-point="floatingPoint" :stepper="floatingPoint" placeholder="Tot oneindig" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="NumberFilterMode.NotBetween" @change="onChange" />
            <p class="style-title-list">
                Niet tussen...
            </p>

            <NumberInput v-if="filter.mode === NumberFilterMode.NotBetween" ref="input" v-model="filter.start" :min="null" :max="null" :required="filter.end === null" :floating-point="floatingPoint" :stepper="floatingPoint" placeholder="Vanaf" class="option" />
            <NumberInput v-if="filter.mode === NumberFilterMode.NotBetween" v-model="filter.end" :min="null" :max="null" :required="filter.start === null" :floating-point="floatingPoint" :stepper="floatingPoint" placeholder="Tot oneindig" class="option" />
        </STListItem>
    </STList>
</template>


<script lang="ts">
import { Radio, STList, STListItem, NumberInput } from "@stamhoofd/components"
import { NumberFilter, NumberFilterMode } from "@stamhoofd/structures";
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({
    components: {
        STListItem,
        STList,
        Radio,
        NumberInput
    }
})
export default class NumberFilterView extends Vue {
    @Prop({ required: true }) 
    filter: NumberFilter<any>

    get NumberFilterMode() {
        return NumberFilterMode
    }

    get floatingPoint() {
        return this.filter.definition.floatingPoint
    }

    get currency() {
        return this.filter.definition.currency
    }

    async onChange() {
        await this.$nextTick();
        console.log("onchange");
        (this.$refs["input"] as any).focus()
    }

}
</script>