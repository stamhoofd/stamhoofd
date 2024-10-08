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

    @Prop({ default: "Vul jouw BTW-nummer hier in" })
        placeholder!: string

    @Prop({ default: "vat number" })
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
                "message": "Vul een BTW-nummer in",
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
                "message": "Ongeldig BTW-nummer: "+ this.VATNumberRaw,
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
