<template>
    <STInputBox :title="title" error-fields="password" :error-box="errorBox">
        <button slot="right" v-tooltip="visible ? 'Verberg wachtwoord' : 'Toon wachtwoord'" class="button icon small" :class="visible ? 'eye-off enabled' : 'eye'" type="button" tabindex="-1" @click.prevent="visible = !visible" />
        <input v-model="passwordRaw" name="new-password" class="input" placeholder="Kies een wachtwoord" autocomplete="new-password" :type="visible ? 'text' : 'password'" @input="passwordRaw = $event.target.value" @change="passwordRaw = $event.target.value">
    </STInputBox>
</template>

<script lang="ts">
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox
    },

    // All attributes that we don't recognize should be passed to the input, and not to the root (except style and class)
    inheritAttrs: false
})
export default class PasswordInput extends Vue {
    @Prop({ default: "Wachtwoord" }) 
        title: string;

    @Prop({ default: null }) 
        validator: Validator | null

    passwordRaw = "";
    valid = true;
    visible = false;

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
        this.passwordRaw = val
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

        this.passwordRaw = this.value ?? ""
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    validate(final = true, silent = false) {
        if (this.passwordRaw !== this.value) {
            this.$emit("input", this.passwordRaw)
        }
        if (!silent) {
            this.errorBox = null
        }
        return true
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