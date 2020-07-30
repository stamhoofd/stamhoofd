<template>
    <STInputBox :title="title" error-fields="email" :error-box="errorBox">
        <input class="input" type="email" :class="{ error: !valid }" v-model="emailRaw" :placeholder="placeholder" @change="validate" :autocomplete="autocomplete"/>
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

    @Prop({ default: "" })
    placeholder!: string

    @Prop({ default: "email" })
    autocomplete!: string

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

    async validate() {
        this.emailRaw = this.emailRaw.trim().toLowerCase()

        if (!this.required && this.emailRaw.length == 0) {
            this.errorBox = null
            this.$emit("input", null)
            return true
        }

        const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!regex.test(this.emailRaw)) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig e-mailadres",
                "field": "email"
            }))
            this.$emit("input", null)
            return false

        } else {
            if (this.emailRaw !== this.value) {
                this.$emit("input", this.emailRaw)
            }
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
