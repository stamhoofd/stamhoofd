<template>
    <STInputBox :title="title" error-fields="time" :error-box="errorBox">
        <input v-model="timeRaw" class="input" type="time" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled" @change="validate">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from "@simonbackx/vue-app-navigation/classes";
import { Formatter } from '@stamhoofd/utility';

import { ErrorBox } from "../errors/ErrorBox";
import { Validator } from "../errors/Validator";
import STInputBox from "./STInputBox.vue";
@Component({
    components: {
        STInputBox
    }
})
export default class TimeMinutesInput extends VueComponent {
    @Prop({ default: "" }) 
        title: string;

    @Prop({ default: null }) 
        validator: Validator | null
    

    timeRaw = "";
    valid = true;

    @Prop({ default: null })
        modelValue!: number | null

    @Prop({ default: true })
        required!: boolean

    @Prop({ default: false })
        disabled!: boolean

    @Prop({ default: "" })
        placeholder!: string

    @Prop({ default: "" })
        autocomplete!: string

    errorBox: ErrorBox | null = null

    @Watch('modelValue')
    onValueChanged(val: number | null) {
        if (val === null) {
            return
        }
        this.timeRaw = Formatter.minutesPadded(val)
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }
        if (this.modelValue) {
            this.timeRaw = Formatter.minutesPadded(this.modelValue)
        } else {
            this.timeRaw = ""
        }

    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.timeRaw = this.timeRaw.trim().toLowerCase()

        if (!this.required && this.timeRaw.length === 0) {
            this.errorBox = null

            if (this.modelValue !== null) {
                this.$emit('update:modelValue', null)
            }
            return true
        }

        const regex = /^([0-9]{1,2}:)?[0-9]{1,2}$/;
        
        if (!regex.test(this.timeRaw)) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": $t(`dce292b4-9edd-4e20-a2e3-e3be80d42eb4`),
                "field": "time"
            }))
            if (this.modelValue !== null) {
                this.$emit('update:modelValue', null)
            }
            return false

        } else {
            const split = this.timeRaw.split(":")
            let hours = parseInt(split[0])
            let minutes = parseInt(split[1] ?? "0")

            if (isNaN(hours)) {
                hours = 0;
            }

            if (isNaN(minutes)) {
                minutes = 0;
            }

            const time = Math.max(0, Math.min(hours*60 + minutes, 24*60 - 1))

            if (time !== this.modelValue) {
                this.$emit('update:modelValue', time)
            }
            this.errorBox = null
            return true
        }
    }
}
</script>
