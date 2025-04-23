<template>
    <STInputBox :title="title" error-fields="VATNumber" :error-box="errorBox">
        <input v-model="VATNumberRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" @change="validate">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from "@simonbackx/vue-app-navigation/classes";
import { Country } from '@stamhoofd/structures';

import { ErrorBox } from "../errors/ErrorBox";
import { Validator } from "../errors/Validator";
import STInputBox from "./STInputBox.vue";

@Component({
    components: {
        STInputBox
    }
})
export default class VATNumberInput extends VueComponent {
    @Prop({ required: true }) 
        country!: Country;
    
    @Prop({ default: "" }) 
        title: string;

    @Prop({ default: null }) 
        validator: Validator | null
    
    VATNumberRaw = "";
    valid = true;

    @Prop({ default: null })
        modelValue!: string | null

    @Prop({ default: true })
        required!: boolean

    @Prop({ default: $t(`c938a4fe-ebdc-4c3c-9d77-bfbb2ef1d6ed`) })
        placeholder!: string

    @Prop({ default: $t(`a0b5e325-c175-4002-a812-4c83e3ce781a`) })
        autocomplete!: string

    errorBox: ErrorBox | null = null

    @Watch('modelValue')
    onValueChanged(val: string | null) {
        if (val === null) {
            return
        }
        this.VATNumberRaw = val
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }

        this.VATNumberRaw = this.modelValue ?? ""
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.VATNumberRaw = this.VATNumberRaw.trim().toUpperCase().replace(/\s/g, " ") // replacement is needed because some apps use non breaking spaces when copying

        if (!this.required && this.VATNumberRaw.length === 0) {
            this.errorBox = null
            this.$emit('update:modelValue', null)
            return true
        }

        if (this.required && this.VATNumberRaw.length === 0) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": $t(`811ea961-373c-4903-bab7-d4b59b7ff2fd`),
                "field": "VATNumber"
            }))
            return false
        }

        if (this.VATNumberRaw.length > 2 && this.VATNumberRaw.substr(0, 2) !== this.country) {
            // Add required country in VAT number
            this.VATNumberRaw = this.country+this.VATNumberRaw
        }

        const jsvat = await import(/* webpackChunkName: "jsvat-next" */ 'jsvat-next');
        const result = jsvat.checkVAT(this.VATNumberRaw, this.country === Country.Belgium ? [jsvat.belgium] : [jsvat.netherlands]);
        
        if (!result.isValid) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": $t(`ee8d4d2c-e080-4ee2-830c-bca556879856`) + ' '+ this.VATNumberRaw,
                "field": "VATNumber"
            }))
            return false

        } else {
            this.VATNumberRaw = result.value ?? this.VATNumberRaw
            this.$emit('update:modelValue', this.VATNumberRaw)
            this.errorBox = null
            return true
        }
    }
}
</script>
