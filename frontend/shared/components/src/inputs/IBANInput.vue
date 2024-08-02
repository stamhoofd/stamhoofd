<template>
    <STInputBox :title="title" error-fields="iban" :error-box="errorBox">
        <input v-model="ibanRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder !== null ? placeholder : $t('shared.inputs.iban.placeholder')" :autocomplete="autocomplete" @change="validate">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox
    }
})
export default class IBANInput extends Vue {
    @Prop({ default: "" }) 
        title: string;

    @Prop({ default: null }) 
        validator: Validator | null
    
    ibanRaw = "";
    valid = true;

    @Prop({ default: null })
        value!: string | null

    @Prop({ default: true })
        required!: boolean

    @Prop({ default: null })
        placeholder!: string | null

    @Prop({ default: "email" })
        autocomplete!: string

    errorBox: ErrorBox | null = null

    @Watch('value')
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

        this.ibanRaw = this.value ?? ""
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.ibanRaw = this.ibanRaw.trim().toUpperCase().replace(/\s/g, " ") // replacement is needed because some apps use non breaking spaces when copying

        if (!this.required && this.ibanRaw.length == 0) {
            this.errorBox = null
            this.$emit("input", null)
            return true
        }

        const ibantools = await import(/* webpackChunkName: "ibantools" */ 'ibantools');
        const iban = ibantools.electronicFormatIBAN(this.ibanRaw); // 'NL91ABNA0517164300'
        
        if (iban === null || !ibantools.isValidIBAN(iban)) {
            if (this.ibanRaw.length == 0) {
                if (STAMHOOFD.environment === 'development') {
                    this.ibanRaw = "BE42631299159354"
                    this.errorBox = new ErrorBox(new SimpleError({
                        "code": "invalid_field",
                        "message": "Vul een rekeningnummer in - automatisch willekeurig rekeningnummer ingevuld",
                        "field": "iban"
                    }))
                    return false

                }
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": "Vul een rekeningnummer in",
                    "field": "iban"
                }))
            } else {
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": "Ongeldig rekeningnummer: "+this.ibanRaw,
                    "field": "iban"
                }))
            }
            
            return false

        } else {
            this.ibanRaw = ibantools.friendlyFormatIBAN(iban) ?? iban
            this.$emit("input", this.ibanRaw)
            this.errorBox = null
            return true
        }
    }
}
</script>