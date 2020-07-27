<template>
    <STInputBox :title="title" error-fields="iban" :error-box="errorBox">
        <input class="input" type="text" :class="{ error: !valid }" v-model="ibanRaw" :placeholder="placeholder" @change="validate" :autocomplete="autocomplete"/>
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

    @Prop({ default: "Bv. BE71 6316 1793 1969" })
    placeholder!: string

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
        this.$emit("input", null)
        this.ibanRaw = this.ibanRaw.trim().toUpperCase()

        if (!this.required && this.ibanRaw.length == 0) {
            this.errorBox = null
            return true
        }

        const ibantools = await import('ibantools');
        const iban = ibantools.electronicFormatIBAN(this.ibanRaw); // 'NL91ABNA0517164300'
       
        
        if (!ibantools.isValidIBAN(iban)) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig rekeningnummer",
                "field": "iban"
            }))
            this.$emit("input", null)
            return false

        } else {
            this.ibanRaw = ibantools.friendlyFormatIBAN(iban)
            this.$emit("input", this.ibanRaw)
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
