<template>
    <div class="input birth-day-selection">
        <select v-model="day" @change="updateDate">
            <option disabled>Dag</option>
            <option v-for="day in 31" :key="day" :value="day">{{ day }}</option>
        </select>

        <select v-model="month" @change="updateDate">
            <option disabled>Maand</option>
            <option v-for="month in 12" :key="month" :value="month">{{ monthText(month) }}</option>
        </select>

        <select v-model="year" @change="updateDate">
            <option disabled>Jaar</option>
            <option v-for="year in 100" :key="year" :value="currentYear - year + 1">{{ currentYear - year + 1 }}</option>
        </select>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Formatter } from "@stamhoofd/utility"
import { Vue, Component, Mixins,Prop, Watch } from "vue-property-decorator";

import DateSelectionView from '../overlays/DateSelectionView.vue';

@Component
export default class BirthDayInput extends Vue {
    @Prop({ default: new Date() })
    value: Date

    day: number = this.value.getDate()
    month: number = this.value.getMonth() + 1
    year: number = this.value.getFullYear()

    currentYear = new Date().getFullYear()

    monthText(month) {
        return Formatter.month(month)
    }

    @Watch('value', { deep: true })
    onValueChanged(val: Date) {
        this.day = val.getDate()
        this.month = val.getMonth() + 1
        this.year = val.getFullYear()
    }

    updateDate() {
        this.$emit("input", new Date(this.year, this.month - 1, this.day))
    }
}
</script>

<style lang="scss">
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/components/inputs.scss";

    .input.birth-day-selection {
        padding-right: 0;
        display: grid;
        grid-template-columns: auto 1fr auto;
        grid-template-rows: auto;

        > select {
            cursor: pointer;

            @extend .input-dropdown;

            // Remove dotted line in Firefox
            &:-moz-focusring {
                color: transparent;
                text-shadow: 0 0 0 #000;
            }
        }

    }
</style>