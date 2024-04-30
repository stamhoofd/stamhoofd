<template>
    <STInputBox :title="title" error-fields="url" :error-box="errorBox">
        <input v-model="urlRaw" class="input" :class="{ error: !valid }" :placeholder="placeholder || $t('dashboard.inputs.website.placeholder')" autocomplete="url" @change="validate(false)" @input="urlRaw = $event.target.value; onTyping();">
    </STInputBox>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, Vue, Watch } from "@simonbackx/vue-app-navigation/classes";

import {ErrorBox} from "../errors/ErrorBox";
import {Validator} from "../errors/Validator";
import STInputBox from "./STInputBox.vue";

@Component({
    components: {
        STInputBox
    }
})
export default class UrlInput extends Vue {
    @Prop({ default: "" })
        title: string

    @Prop({ default: null }) 
        validator: Validator | null

    urlRaw = "";
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

    @Prop({ default: "" })
        placeholder!: string

    errorBox: ErrorBox | null = null

    @Watch('value')
    onValueChanged(val: string | null) {
        if (val === null) {
            this.urlRaw = ""
            return
        }
        this.urlRaw = val
    }

    onTyping() {
        // Silently send value to parents, but don't show visible errors yet
        this.validate(false, true);
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate(true)
            })
        }

        this.urlRaw = this.value ?? ""
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    validate(final: boolean, silent = false) {
        if (this.urlRaw.length == 0) {

            if (!this.required) {
                if (!silent) {
                    this.errorBox = null
                }

                if (this.value !== null) {
                    this.$emit('update:modelValue', null)
                }
                return true
            }

            if (!final) {
                if (!silent) {
                    this.errorBox = null
                }

                if (this.nullable && this.value !== null) {
                    this.$emit('update:modelValue', null)
                }
                return false
            }
        }
        try {
            let autoCorrected = this.urlRaw

            if (!autoCorrected.startsWith("http://") && !autoCorrected.startsWith("https://")) {
                autoCorrected = "https://"+autoCorrected
            }

            try {
                const u = new URL(autoCorrected)
                autoCorrected = u.href;
                if (u.pathname === '/' && autoCorrected[autoCorrected.length - 1] === '/') {
                    // Remove trailing slash on root domains (because ugly)
                    autoCorrected = autoCorrected.substring(0, autoCorrected.length - 1);
                }
            } catch (e) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'url',
                    message: 'Invalid url',
                    human: this.$t("shared.inputs.url.invalidMessage").toString(),
                })
            }

            const v = silent ? this.urlRaw : autoCorrected;
            this.urlRaw = v
    
            if (this.value !== v) {
                this.$emit('update:modelValue', v)
            }
            if (!silent) {
                this.errorBox = null
            }
            return true
        } catch (e) {
            console.error(e)
            if (!silent) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    this.errorBox = new ErrorBox(e);
                    return false;
                }
                this.errorBox = new ErrorBox(new SimpleError({
                    "code": "invalid_field",
                    "message": this.$t("shared.inputs.url.invalidMessage").toString(),
                    "field": "url"
                }))
            }
            return false
        }
        
    }
}
</script>