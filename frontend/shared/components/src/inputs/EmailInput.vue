<template>
    <STInputBox :title="title" error-fields="email" :error-box="errorBox">
        <input ref="input" v-model="emailRaw" class="email-input-field input" :name="name" type="email" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled" @change="validate">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { DataValidator } from "@stamhoofd/utility";
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox
    }
})
export default class EmailInput extends Vue {
    @Prop({ default: "" }) 
    title: string;

    @Prop({ default: null }) 
    validator: Validator | null
    

    emailRaw = "";
    valid = true;

    @Prop({ default: null })
    value!: string | null

    @Prop({ default: true })
    required!: boolean

    @Prop({ default: false })
    disabled!: boolean

    @Prop({ default: "" })
    placeholder!: string

    @Prop({ default: "email" })
    autocomplete!: string

    @Prop({ default: undefined })
    name?: string

    errorBox: ErrorBox | null = null

    @Watch('value')
    onValueChanged(val: string | null) {
        if (val === null) {
            return
        }
        this.emailRaw = val
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }

        this.emailRaw = this.value ?? ""
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    validate() {
        this.emailRaw = this.emailRaw.trim().toLowerCase()

        if (!this.required && this.emailRaw.length == 0) {
            this.errorBox = null

            if (this.value !== null) {
                this.$emit("input", null)
            }
            return true
        }
        
        if (!DataValidator.isEmailValid(this.emailRaw)) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig e-mailadres",
                "field": "email"
            }))
            return false

        } else {
            if (this.emailRaw !== this.value) {
                this.$emit("input", this.emailRaw)
            }
            this.errorBox = null
            return true
        }
    }

    focus() {
        (this.$refs.input as any)?.focus()
    }
}
</script>

<style lang="scss">
    .email-input-field {
        // Fix safari bug that shows the autofill on the wrong position
        transform: translate3d(0, 0, 0);
    }
</style>