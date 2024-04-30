<template>
    <STInputBox :title="title" error-fields="email" :error-box="errorBox">
        <input ref="input" v-model="emailRaw" class="email-input-field input" type="email" :class="{ error: !valid }" :disabled="disabled" v-bind="$attrs" @change="validate(false)" @input="emailRaw = $event.target.value; onTyping();">
        <template #right><slot name="right" /></template>
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { DataValidator } from "@stamhoofd/utility";
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

import {ErrorBox} from "../errors/ErrorBox";
import {Validator} from "../errors/Validator";
import STInputBox from "./STInputBox.vue";

@Component({
    components: {
        STInputBox
    },

    // All attributes that we don't recognize should be passed to the input, and not to the root (except style and class)
    inheritAttrs: false
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

    /**
     * Whether the value can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    @Prop({ default: false })
        nullable!: boolean

    @Prop({ default: false })
        disabled!: boolean

    errorBox: ErrorBox | null = null

    @Watch('value')
    onValueChanged(val: string | null) {
        if (val === null) {
            return
        }
        this.emailRaw = val
    }

    onTyping() {
        // Silently send value to parents, but don't show visible errors yet
        this.validate(false, true)
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate(true)
            })
        }

        this.emailRaw = this.value ?? ""
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    validate(final = true, silent = false) {
        this.emailRaw = this.emailRaw.trim().toLowerCase()

        if (!this.required && this.emailRaw.length == 0) {
            if (!silent) {
                this.errorBox = null
            }

            if (this.value !== null) {
                this.$emit('update:modelValue', null)
            }
            return true
        }

        if (this.required && this.emailRaw.length == 0 && !final) {
            // Ignore empty email if not final
            if (!silent) {
                this.errorBox = null
            }

            if (this.nullable && this.value !== null) {
                this.$emit('update:modelValue', null)
            } else if (this.value !== "") {
                this.$emit('update:modelValue', "")
            }
            return false
        }
        
        if (!DataValidator.isEmailValid(this.emailRaw)) {
            if (!silent) {
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": "Ongeldig e-mailadres",
                    "field": "email"
                }))
            }
            return false

        } else {
            if (this.emailRaw !== this.value) {
                this.$emit('update:modelValue', this.emailRaw)
            }
            if (!silent) {
                this.errorBox = null
            }
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