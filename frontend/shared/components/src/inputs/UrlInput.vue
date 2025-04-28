<template>
    <STInputBox :title="title" error-fields="url" :error-box="errorBox">
        <input v-model="urlRaw" class="input" :class="{ error: !valid }" :placeholder="placeholder || $t('5d75775a-a4b5-426a-aea9-b1e75ee5f055')" autocomplete="url" @change="validate(false)" @input="(event: any) => {urlRaw = event.target.value; onTyping();}">
    </STInputBox>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from '../errors/ErrorBox';
import { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
    },
})
export default class UrlInput extends VueComponent {
    @Prop({ default: '' })
    title: string;

    @Prop({ default: null })
    validator: Validator | null;

    urlRaw = '';
    valid = true;

    @Prop({ default: null })
    modelValue!: string | null;

    @Prop({ default: true })
    required!: boolean;

    /**
     * Whether the value can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    @Prop({ default: false })
    nullable!: boolean;

    @Prop({ default: '' })
    placeholder!: string;

    errorBox: ErrorBox | null = null;

    @Watch('modelValue')
    onValueChanged(val: string | null) {
        if (val === null) {
            this.urlRaw = '';
            return;
        }
        this.urlRaw = val;
    }

    onTyping() {
        // Silently send value to parents, but don't show visible errors yet
        this.validate(false, true);
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate(true);
            });
        }

        this.urlRaw = this.modelValue ?? '';
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this);
        }
    }

    validate(final: boolean, silent = false) {
        if (this.urlRaw.length === 0) {
            if (!this.required) {
                if (!silent) {
                    this.errorBox = null;
                }

                if (this.modelValue !== null) {
                    this.$emit('update:modelValue', null);
                }
                return true;
            }

            if (!final) {
                if (!silent) {
                    this.errorBox = null;
                }

                if (this.nullable && this.modelValue !== null) {
                    this.$emit('update:modelValue', null);
                }
                return false;
            }
        }
        try {
            let autoCorrected = this.urlRaw;

            if (!autoCorrected.startsWith('http://') && !autoCorrected.startsWith('https://')) {
                autoCorrected = 'https://' + autoCorrected;
            }

            try {
                const u = new URL(autoCorrected);
                autoCorrected = u.href;
                if (u.pathname === '/' && autoCorrected[autoCorrected.length - 1] === '/') {
                    // Remove trailing slash on root domains (because ugly)
                    autoCorrected = autoCorrected.substring(0, autoCorrected.length - 1);
                }
            }
            catch (e) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'url',
                    message: 'Invalid url',
                    human: this.$t('a68b5c92-df5d-4413-a00a-61139f6efe19').toString(),
                });
            }

            const v = silent ? this.urlRaw : autoCorrected;
            this.urlRaw = v;

            if (this.modelValue !== v) {
                this.$emit('update:modelValue', v);
            }
            if (!silent) {
                this.errorBox = null;
            }
            return true;
        }
        catch (e) {
            console.error(e);
            if (!silent) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    this.errorBox = new ErrorBox(e);
                    return false;
                }
                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_field',
                    message: this.$t('a68b5c92-df5d-4413-a00a-61139f6efe19').toString(),
                    field: 'url',
                }));
            }
            return false;
        }
    }
}
</script>
