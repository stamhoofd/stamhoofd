<template>
    <STInputBox :title="title" error-fields="phone" :error-box="errorBox">
        <input class="input" :class="{ error: !valid }" v-model="phoneRaw" :placeholder="placeholder" @change="validate" autocomplete="mobile tel"/>
    </STInputBox>
</template>

<script lang="ts">
import { Component, Prop,Vue, Watch } from "vue-property-decorator";
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"

@Component({
    components: {
        STInputBox
    }
})
export default class PhoneInput extends Vue {
    @Prop({ default: "" }) 
    title: string;

    @Prop({ default: null }) 
    validator: Validator | null

    phoneRaw = "";
    valid = true;

    @Prop({ default: null })
    value!: string | null

    @Prop({ default: true })
    required!: boolean

    @Prop({ default: "" })
    placeholder!: string

    errorBox: ErrorBox | null = null

    @Watch('value')
    onValueChanged(val: string | null) {
        if (val === null) {
            return
        }
        this.phoneRaw = val
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }

        this.phoneRaw = this.value ?? ""
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.$emit("input", null)

        if (!this.required && this.phoneRaw.length == 0) {
            this.errorBox = null
            return true
        }
        const libphonenumber = await import("libphonenumber-js")
        const phoneNumber = libphonenumber.parsePhoneNumberFromString(this.phoneRaw, "BE")

        if (!phoneNumber || !phoneNumber.isValid()) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig GSM-nummer",
                "field": "phone"
            }))
            this.$emit("input", null)
            return false

        } else {
            this.$emit("input", phoneNumber.formatInternational())
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
