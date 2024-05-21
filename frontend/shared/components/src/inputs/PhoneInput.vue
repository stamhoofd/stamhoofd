<template>
    <STInputBox :title="title" error-fields="phone" :error-box="errorBox">
        <input v-model="phoneRaw" class="input" :class="{ error: !valid }" :placeholder="placeholder" autocomplete="mobile tel" type="tel" @change="validate(false)" @input="(event) => {phoneRaw = event.target.value; onTyping();}">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Country } from "@stamhoofd/structures"
import { Component, Prop,Vue, Watch } from "@simonbackx/vue-app-navigation/classes";

import {ErrorBox} from "../errors/ErrorBox";
import {Validator} from "../errors/Validator";
import STInputBox from "./STInputBox.vue";

@Component({
    components: {
        STInputBox
    },
    emits: ["update:modelValue"]
})
export default class PhoneInput extends Vue {
    @Prop({ default: "" }) 
        title: string;

    @Prop({ default: null }) 
        validator: Validator | null

    phoneRaw = "";
    valid = true;

    @Prop({ default: null })
        modelValue!: string | null

    @Prop({ default: true })
        required!: boolean

    /**
     * Whether the modelValue can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    @Prop({ default: false })
        nullable!: boolean

    @Prop({ default: "" })
        placeholder!: string

    errorBox: ErrorBox | null = null

    @Watch('modelValue')
    onmodelValueChanged(val: string | null) {
        if (val === null) {
            this.phoneRaw = ""
            return
        }
        this.phoneRaw = val
    }

    @Watch('required', { deep: true })
    onChangeRequired() {
        // Revalidate, because the fields might be empty, and required goes false -> send null so any saved address gets cleared
        this.validate(false, true).catch(console.error)
    }

    onTyping() {
        // Silently send modelValue to parents, but don't show visible errors yet
        this.validate(false, true).catch(console.error)
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate(true)
            })
        }

        this.phoneRaw = this.modelValue ?? ""
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate(final: boolean, silent = false) {

        if (this.phoneRaw.length == 0) {

            if (!this.required) {
                if (!silent) {
                    this.errorBox = null
                }

                if (this.modelValue !== null) {
                    this.$emit('update:modelValue', null)
                }
                return true
            }

            if (!final) {
                if (!silent) {
                    this.errorBox = null
                }

                if (this.nullable && this.modelValue !== null) {
                    this.$emit('update:modelValue', null)
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
                        if (!silent) {
                            this.errorBox = new ErrorBox(new SimpleError({
                                "code": "invalid_field",
                                "message": this.$t("shared.inputs.mobile.invalidMessageTryCountry").toString(),
                                "field": "phone"
                            }))
                        }
                        return false
                    }
                }
                if (!silent) {
                    this.errorBox = new ErrorBox(new SimpleError({
                        "code": "invalid_field",
                        "message": this.$t("shared.inputs.mobile.invalidMessage").toString(),
                        "field": "phone"
                    }))
                }
                return false

            } else {
                const v = silent ? this.phoneRaw : phoneNumber.formatInternational();
                this.phoneRaw = v
        
                if (this.modelValue !== v) {
                    this.$emit('update:modelValue', v)
                }
                if (!silent) {
                    this.errorBox = null
                }
                return true
            }
        } catch (e) {
            console.error(e)
            if (!silent) {
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": this.$t("shared.inputs.mobile.invalidMessage").toString(),
                    "field": "phone"
                }))
            }
            return false
        }
        
    }
}
</script>
