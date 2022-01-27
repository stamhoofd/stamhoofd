<template>
    <STInputBox :title="title" error-fields="phone" :error-box="errorBox">
        <input v-model="phoneRaw" class="input" :class="{ error: !valid }" :placeholder="placeholder" autocomplete="mobile tel" @change="validate(false)">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Country } from "@stamhoofd/structures"
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

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

    /**
     * Whether the value can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    @Prop({ default: false })
    nullable!: boolean

    @Prop({ default: "" })
    placeholder!: string

    errorBox: ErrorBox | null = null

    @Watch('value')
    onValueChanged(val: string | null) {
        if (val === null) {
            this.phoneRaw = ""
            return
        }
        this.phoneRaw = val
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate(true)
            })
        }

        this.phoneRaw = this.value ?? ""
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate(final: boolean) {

        if (this.phoneRaw.length == 0) {

            if (!this.required) {
                this.errorBox = null

                if (this.value !== null) {
                    this.$emit("input", null)
                }
                return true
            }

            if (!final) {
                this.errorBox = null

                if (this.nullable && this.value !== null) {
                    this.$emit("input", null)
                }
                return false
            }
        }
        try {
            const libphonenumber = await import(/* webpackChunkName: "libphonenumber" */ "libphonenumber-js/max")
            const phoneNumber = libphonenumber.parsePhoneNumber(this.phoneRaw, I18nController.shared?.country ?? Country.Belgium)

            if (!phoneNumber || !phoneNumber.isValid()) {
                for (const country of Object.values(Country)) {
                    const phoneNumber = libphonenumber.parsePhoneNumber(this.phoneRaw, country)

                    if (phoneNumber && phoneNumber.isValid()) {
                        this.errorBox = new ErrorBox(new SimpleError({
                            "code": "invalid_field",
                            "message": this.$t("shared.inputs.mobile.invalidMessageTryCountry").toString(),
                            "field": "phone"
                        }))
                        return false
                    }
                }
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": this.$t("shared.inputs.mobile.invalidMessage").toString(),
                    "field": "phone"
                }))
                return false

            } else {
                const v = phoneNumber.formatInternational();
                this.phoneRaw = v
        
                if (this.value !== v) {
                    this.$emit("input", v)
                }
                this.errorBox = null
                return true
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": this.$t("shared.inputs.mobile.invalidMessage").toString(),
                "field": "phone"
            }))
            return false
        }
        
    }
}
</script>