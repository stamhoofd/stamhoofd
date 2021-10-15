<template>
    <STList>
        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="DateFilterMode.Equal" @change="onChange" />
            <p class="style-title-list">
                Gelijk aan...
            </p>
            <DateSelection v-if="filter.mode === DateFilterMode.Equal" ref="input" v-model="filter.minimumDate" :min="null" :max="null" :required="true" placeholder="Vul datum in" class="option" />
            <TimeInput v-if="time && filter.mode === DateFilterMode.Equal" ref="input" v-model="filter.minimumDate" :min="null" :max="null" :required="true" placeholder="Tijdstip" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="DateFilterMode.NotEqual" @change="onChange" />
            <p class="style-title-list">
                Niet gelijk aan...
            </p>

            <DateSelection v-if="filter.mode === DateFilterMode.NotEqual" ref="input" v-model="filter.minimumDate" :min="null" :max="null" :required="true" placeholder="Vul datum in" class="option" />
            <TimeInput v-if="time && filter.mode === DateFilterMode.NotEqual" ref="input" v-model="filter.minimumDate" :min="null" :max="null" :required="true" placeholder="Tijdstip" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="DateFilterMode.GreaterThan" @change="onChange" />
            <p class="style-title-list">
                Na of op...
            </p>

            <DateSelection v-if="filter.mode === DateFilterMode.GreaterThan" ref="input" v-model="filter.minimumDate" :min="null" :max="null" placeholder="Vul datum in" class="option" />
            <TimeInput v-if="time && filter.mode === DateFilterMode.GreaterThan" ref="input" v-model="filter.minimumDate" :min="null" :max="null" placeholder="Tijdstip" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="DateFilterMode.LessThan" @change="onChange" />
            <p class="style-title-list">
                Voor of op...
            </p>

            <DateSelection v-if="filter.mode === DateFilterMode.LessThan" ref="input" v-model="filter.maximumDate" :min="null" :max="null" placeholder="Vul datum in" class="option" />
            <TimeInput v-if="time && filter.mode === DateFilterMode.LessThan" ref="input" v-model="filter.maximumDate" :min="null" :max="null" placeholder="Tijdstip" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="DateFilterMode.Between" @change="onChange" />
            <p class="style-title-list">
                Tussen...
            </p>

            <DateSelection v-if="filter.mode === DateFilterMode.Between" ref="input" v-model="filter.minimumDate" :min="null" :max="filter.maximumDate" placeholder="Van" class="option" />
            <TimeInput v-if="time && filter.mode === DateFilterMode.Between" ref="input" v-model="filter.minimumDate" :min="null" :max="filter.maximumDate" placeholder="Van" class="option" />

            <DateSelection v-if="filter.mode === DateFilterMode.Between" v-model="filter.maximumDate" :min="filter.minimumDate" :max="null" placeholder="Tot" class="option" />
            <TimeInput v-if="time && filter.mode === DateFilterMode.Between" v-model="filter.maximumDate" :min="filter.minimumDate" :max="null" placeholder="Tot" class="option" />
        </STListItem>

        <STListItem :selectable="true" element-name="label" @click="onChange">
            <Radio slot="left" v-model="filter.mode" :name="filter.id" :value="DateFilterMode.NotBetween" @change="onChange" />
            <p class="style-title-list">
                Niet tussen...
            </p>

            <DateSelection v-if="filter.mode === DateFilterMode.NotBetween" ref="input" v-model="filter.minimumDate" :min="null" :max="filter.maximumDate" :required="filter.maximumDate === null" placeholder="Vanaf" class="option" />
            <TimeInput v-if="time && filter.mode === DateFilterMode.NotBetween" ref="input" v-model="filter.minimumDate" :min="null" :max="filter.maximumDate" :required="filter.maximumDate === null" placeholder="Vanaf" class="option" />

            <DateSelection v-if="filter.mode === DateFilterMode.NotBetween" v-model="filter.maximumDate" :min="filter.minimumDate" :max="null" :required="filter.minimumDate === null" placeholder="Tot" class="option" />
            <TimeInput v-if="time && filter.mode === DateFilterMode.NotBetween" v-model="filter.maximumDate" :min="filter.minimumDate" :max="null" :required="filter.minimumDate === null" placeholder="Tot" class="option" />
        </STListItem>
    </STList>
</template>


<script lang="ts">
import { DateSelection, Radio, STList, STListItem, TimeInput } from "@stamhoofd/components"
import { DateFilter, DateFilterMode } from "@stamhoofd/structures"
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({
    components: {
        STListItem,
        STList,
        Radio,
        DateSelection,
        TimeInput
    }
})
export default class DateFilterView extends Vue {
    @Prop({ required: true }) 
    filter: DateFilter<any>

    get DateFilterMode() {
        return DateFilterMode
    }

    get time() {
        return this.filter.definition.time
    }

    async onChange() {
        await this.$nextTick();
        (this.$refs["input"] as any).focus()
    }

}
</script>