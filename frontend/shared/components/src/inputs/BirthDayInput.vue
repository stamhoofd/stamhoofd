<template>
    <STInputBox :title="title" error-fields="birthDay" :error-box="errorBox">
        <div class="input birth-day-selection">
            <div class="input-icon-container right icon arrow-down-small gray">
                <select v-model="day" autocomplete="bday-day" name="bday-day" @change="updateDate">
                    <!-- name is needed for autocomplete in safari -->
                    <option :disabled="required" :value="null">
                        Dag
                    </option>
                    <option v-for="day in 31" :key="day" :value="day" autocomplete="bday-day">
                        {{ day }}
                    </option>
                </select>
            </div>

            <div class="input-icon-container right icon arrow-down-small gray">
                <select v-model="month" autocomplete="bday-month" name="bday-month" @change="updateDate">
                    <option :disabled="required" :value="null">
                        Maand
                    </option>
                    <option v-for="month in 12" :key="month" :value="month" autocomplete="bday-month">
                        {{ monthText(month) }}
                    </option>
                </select>
            </div>

            <div class="input-icon-container right icon arrow-down-small gray">
                <select v-model="year" autocomplete="bday-year" name="bday-year" @change="updateDate">
                    <option :disabled="required" :value="null">
                        Jaar
                    </option>
                    <option v-for="year in 100" :key="year" :value="currentYear - year + 1" autocomplete="bday-year">
                        {{ currentYear - year + 1 }}
                    </option>
                </select>
            </div>
        </div>
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from "@simonbackx/vue-app-navigation/classes";
import { Formatter } from "@stamhoofd/utility"

import {ErrorBox} from "../errors/ErrorBox";
import {Validator} from "../errors/Validator";
import STInputBox from "./STInputBox.vue";

@Component({
    components: {
        STInputBox
    },
    emits: ['update:modelValue']
})
export default class BirthDayInput extends VueComponent {
    @Prop({ default: "" }) 
        title: string;

    @Prop({ default: true })
        required!: boolean

    @Prop({ default: null})
        modelValue!: Date | null

    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
        validator: Validator | null

    errorBox: ErrorBox | null = null

    day: number | null = this.modelValue?.getDate() ?? null
    month: number | null  = this.modelValue ? this.modelValue.getMonth() + 1 : null
    year: number | null  = this.modelValue?.getFullYear() ?? null

    currentYear = new Date().getFullYear()

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    monthText(month) {
        return Formatter.month(month)
    }

    @Watch('modelValue', { deep: true })
    onValueChanged(val: Date | null) {
        if (val) {
            this.day = val.getDate()
            this.month = val.getMonth() + 1
            this.year = val.getFullYear()
        } else {
            this.day = null;
            this.month = null;
            this.year = null;
        }
    }

    updateDate() {
        if (this.year && this.month && this.day) {
            this.$emit('update:modelValue', new Date(this.year, this.month - 1, this.day, 12))
        } else {
            this.$emit('update:modelValue', null)
        }
    }

    validate() {
        if (this.year && this.month && this.day) {
            if (!this.modelValue) {
                this.$emit('update:modelValue', new Date(this.year, this.month - 1, this.day, 12))
            }
            this.errorBox = null
            return true
        }

        if (!this.required) {
            this.errorBox = null

            if (this.modelValue !== null) {
                this.$emit('update:modelValue', null)
            }
            return true
        }

        if (this.modelValue !== null) {
            this.$emit('update:modelValue', null)
        }
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
@use "@stamhoofd/scss/base/text-styles.scss" as *;
@use "@stamhoofd/scss/base/variables.scss" as *;

.input.birth-day-selection {
    padding-right: 0;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto;
    align-items: stretch;

    > div {
        display: flex;
        align-items: stretch;

        > select {
            @extend .style-input;
            color: $color-dark;
        }

        // Remove dotted line in Firefox
        > select:-moz-focusring {
            color: transparent;
            text-shadow: 0 0 0 #000;
        }
    }

}
</style>
