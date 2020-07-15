<template>
    <STInputBox :title="title" error-fields="birthDay" :error-box="errorBox">
        <div class="input birth-day-selection">
            <select v-model="day" @change="updateDate" autocomplete="bday-day" name="bday-day"> <!-- name is needed for autocomplete in safari -->
                <option disabled :value="null">Dag</option>
                <option v-for="day in 31" :key="day" :value="day" autocomplete="bday-day">{{ day }}</option>
            </select>

            <select v-model="month" @change="updateDate" autocomplete="bday-month" name="bday-month">
                <option disabled :value="null">Maand</option>
                <option v-for="month in 12" :key="month" :value="month" autocomplete="bday-month">{{ monthText(month) }}</option>
            </select>

            <select v-model="year" @change="updateDate" autocomplete="bday-year" name="bday-year">
                <option disabled :value="null">Jaar</option>
                <option v-for="year in 100" :key="year" :value="currentYear - year + 1" autocomplete="bday-year">{{ currentYear - year + 1 }}</option>
            </select>
        </div>
    </STInputBox>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Formatter } from "@stamhoofd/utility"
import { Vue, Component, Mixins,Prop, Watch } from "vue-property-decorator";

import DateSelectionView from '../overlays/DateSelectionView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"

@Component({
    components: {
        STInputBox
    }
})
export default class BirthDayInput extends Vue {
    @Prop({ default: "" }) 
    title: string;

    @Prop({ default: null})
    value: Date | null

    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
    validator: Validator | null

    errorBox: ErrorBox | null = null

    day: number | null = this.value?.getDate() ?? null
    month: number | null  = this.value ? this.value.getMonth() + 1 : null
    year: number | null  = this.value?.getFullYear() ?? null

    currentYear = new Date().getFullYear()

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

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
        console.log("update date")
        if (this.year && this.month && this.day) {
            this.$emit("input", new Date(this.year, this.month - 1, this.day))
        } else {
            this.$emit("input", null)
        }
    }

    validate() {
        if (this.year && this.month && this.day) {
            this.$emit("input", new Date(this.year, this.month - 1, this.day))
            this.errorBox = null
            return true
        }
        this.$emit("input", null)
        this.errorBox = new ErrorBox(new SimpleError({
            code: "empty_field",
            message: "Vul de geboortedatum in",
            field: "birthDay"
        }))
        return false
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