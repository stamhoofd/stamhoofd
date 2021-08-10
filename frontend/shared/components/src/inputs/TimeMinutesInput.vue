<template>
    <STInputBox :title="title" error-fields="time" :error-box="errorBox">
        <input v-model="timeRaw" class="input" type="time" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled" @change="validate">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox
    }
})
export default class TimeMinutesInput extends Vue {
    @Prop({ default: "" }) 
    title: string;

    @Prop({ default: null }) 
    validator: Validator | null
    

    timeRaw = "";
    valid = true;

    @Prop({ default: null })
    value!: number | null

    @Prop({ default: true })
    required!: boolean

    @Prop({ default: false })
    disabled!: boolean

    @Prop({ default: "" })
    placeholder!: string

    @Prop({ default: "" })
    autocomplete!: string

    errorBox: ErrorBox | null = null

    @Watch('value')
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
        if (this.value) {
            this.timeRaw = Formatter.minutesPadded(this.value)
        } else {
            this.timeRaw = ""
        }

    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.timeRaw = this.timeRaw.trim().toLowerCase()

        if (!this.required && this.timeRaw.length == 0) {
            this.errorBox = null

            if (this.value !== null) {
                this.$emit("input", null)
            }
            return true
        }

        const regex = /^([0-9]{1,2}:)?[0-9]{1,2}$/;
        
        if (!regex.test(this.timeRaw)) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig tijdstip. Voer in zoals bv. '12:30'",
                "field": "time"
            }))
            if (this.value !== null) {
                this.$emit("input", null)
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

            if (time !== this.value) {
                this.$emit("input", time)
            }
            this.errorBox = null
            return true
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;

</style>
