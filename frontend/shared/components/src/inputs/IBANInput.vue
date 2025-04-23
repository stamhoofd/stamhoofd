<template>
    <STInputBox :title="title" error-fields="iban" :error-box="errorBox">
        <input v-model="ibanRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder !== null ? placeholder : $t('0c63751f-8cd1-48af-a8a6-2b6a02447d63')" :autocomplete="autocomplete" @change="validate">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from "@simonbackx/vue-app-navigation/classes";

import {ErrorBox} from "../errors/ErrorBox";
import {Validator} from "../errors/Validator";
import STInputBox from "./STInputBox.vue";

@Component({
    components: {
        STInputBox
    }
})
export default class IBANInput extends VueComponent {
    @Prop({ default: "" }) 
        title: string;

    @Prop({ default: null }) 
        validator: Validator | null
    
    ibanRaw = "";
    valid = true;

    @Prop({ default: null })
        modelValue!: string | null

    @Prop({ default: true })
        required!: boolean

    @Prop({ default: null })
        placeholder!: string | null

    @Prop({ default: $t(`6285b165-8d32-4a00-bb3f-0f95abcda58f`) })
        autocomplete!: string

    errorBox: ErrorBox | null = null

    @Watch('modelValue')
    onValueChanged(val: string | null) {
        if (val === null) {
            return
        }
        this.ibanRaw = val
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }

        this.ibanRaw = this.modelValue ?? ""
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.ibanRaw = this.ibanRaw.trim().toUpperCase().replace(/\s/g, " ") // replacement is needed because some apps use non breaking spaces when copying

        if (!this.required && this.ibanRaw.length === 0) {
            this.errorBox = null
            this.$emit('update:modelValue', null)
            return true
        }

        const ibantools = await import(/* webpackChunkName: "ibantools" */ 'ibantools');
        const iban = ibantools.electronicFormatIBAN(this.ibanRaw); // 'NL91ABNA0517164300'
        
        if (iban === null || !ibantools.isValidIBAN(iban)) {
            if (this.ibanRaw.length === 0) {
                if (STAMHOOFD.environment === 'development') {
                    this.ibanRaw = "BE42631299159354"
                    this.errorBox = new ErrorBox(new SimpleError({
                        "code": "invalid_field",
                        "message": $t(`1b84633d-5f01-44ec-ae98-dd096dd13fb4`),
                        "field": "iban"
                    }))
                    return false

                }
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": $t(`14eefa10-1257-4e98-bcd5-6bddef38fa03`),
                    "field": "iban"
                }))
            } else {
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": $t(`b2add4d5-65c6-4a91-9e10-f74cadf24001`) + ' '+this.ibanRaw,
                    "field": "iban"
                }))
            }
            
            return false

        } else {
            this.ibanRaw = ibantools.friendlyFormatIBAN(iban) ?? iban
            this.$emit('update:modelValue', this.ibanRaw)
            this.errorBox = null
            return true
        }
    }
}
</script>
