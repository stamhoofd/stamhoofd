<template>
    <STInputBox :title="title" error-fields="time" :error-box="errorBox">
        <input v-model="timeRaw" class="input" type="time" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled" @input="(event) => {timeRaw = event.currentTarget.value; validate();}">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, Vue, Watch } from "@simonbackx/vue-app-navigation/classes";
import { Formatter } from '@stamhoofd/utility';

import { ErrorBox } from "../errors/ErrorBox";
import { Validator } from "../errors/Validator";
import STInputBox from "./STInputBox.vue";

@Component({
    components: {
        STInputBox
    }
})
export default class TimeInput extends Vue {
    @Prop({ default: "" }) 
        title: string;

    @Prop({ default: null }) 
        validator: Validator | null

    timeRaw = "";
    valid = true;

    @Prop({ required: true })
        modelValue!: Date

    @Prop({ default: false })
        disabled!: boolean

    @Prop({ default: "" })
        placeholder!: string

    @Prop({ default: "" })
        autocomplete!: string

    errorBox: ErrorBox | null = null

    @Watch('modelValue', {deep: true})
    onValueChanged(val: Date) {
        if (val === null) {
            return
        }
        this.timeRaw = Formatter.timeIso(this.modelValue)
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }
        this.timeRaw = Formatter.timeIso(this.modelValue)
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.timeRaw = this.timeRaw.trim().toLowerCase()

        const regex = /^([0-9]{1,2}:)?[0-9]{1,2}$/;
        
        if (!regex.test(this.timeRaw)) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig tijdstip. Voer in zoals bv. '12:30'",
                "field": "time"
            }))
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

            if (hours > 24 || minutes > 60) {
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": "Ongeldig tijdstip. Voer in zoals bv. '12:30'",
                    "field": "time"
                }))
                return false
            }
 
            const d = new Date(this.modelValue.getTime())
            d.setHours(hours, minutes, 0, 0)
            this.$emit('update:modelValue', d)

            this.errorBox = null
            return true
        }
    }
}
</script>
