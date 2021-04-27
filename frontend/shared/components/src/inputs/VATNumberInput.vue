<template>
    <STInputBox :title="title" error-fields="VATNumber" :error-box="errorBox">
        <input v-model="VATNumberRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" @change="validate">
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
    
    VATNumberRaw = "";
    valid = true;

    @Prop({ default: null })
    value!: string | null

    @Prop({ default: true })
    required!: boolean

    @Prop({ default: "Vul jouw BTW-nummer hier in" })
    placeholder!: string

    @Prop({ default: "vat number" })
    autocomplete!: string

    errorBox: ErrorBox | null = null

    @Watch('value')
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

        this.VATNumberRaw = this.value ?? ""
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async validate() {
        this.VATNumberRaw = this.VATNumberRaw.trim().toUpperCase().replace(/\s/g, " ") // replacement is needed because some apps use non breaking spaces when copying

        if (!this.required && this.VATNumberRaw.length == 0) {
            this.errorBox = null
            this.$emit("input", null)
            return true
        }

        const jsvat = await import(/* webpackChunkName: "jsvat" */ 'jsvat');
        const result = jsvat.checkVAT(this.VATNumberRaw, [jsvat.belgium, jsvat.netherlands]);
        
        if (!result.isValid) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig BTW-nummer: "+this.VATNumberRaw,
                "field": "VATNumber"
            }))
            return false

        } else {
            this.VATNumberRaw = result.value ?? this.VATNumberRaw
            this.$emit("input", this.VATNumberRaw)
            this.errorBox = null
            return true
        }
    }
}
</script>