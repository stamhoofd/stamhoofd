<template>
    <STInputBox :title="title" error-fields="iban" :error-box="errorBox">
        <input v-model="ibanRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder !== null ? placeholder : $t('%2x')" :autocomplete="autocomplete" @change="validate">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';

import { ErrorBox } from '../errors/ErrorBox';
import type { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
    },
})
export default class IBANInput extends VueComponent {
    @Prop({ default: '' })
    title: string;

    @Prop({ default: null })
    validator: Validator | null;

    ibanRaw = '';
    valid = true;

    @Prop({ default: null })
    modelValue!: string | null;

    @Prop({ default: true })
    required!: boolean;

    @Prop({ default: null })
    placeholder!: string | null;

    @Prop({ default: $t(`%16`) })
    autocomplete!: string;

    errorBox: ErrorBox | null = null;

    /**
     * For some crazy reason $t is not found in the template by typescript checking
     * Will get fixed when we switch this component to Setup syntax
     */
    get $t() {
        return $t;
    }

    @Watch('modelValue')
    onValueChanged(val: string | null) {
        if (val === null) {
            return;
        }
        this.ibanRaw = val;
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate();
            });
        }

        this.ibanRaw = this.modelValue ?? '';
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this);
        }
    }

    async validate() {
        this.ibanRaw = this.ibanRaw.trim().toUpperCase().replace(/\s/g, ' '); // replacement is needed because some apps use non breaking spaces when copying

        if (!this.required && this.ibanRaw.length === 0) {
            this.errorBox = null;
            this.$emit('update:modelValue', null);
            return true;
        }

        const ibantools = await import(/* webpackChunkName: "ibantools" */ 'ibantools');
        const iban = ibantools.electronicFormatIBAN(this.ibanRaw); // 'NL91ABNA0517164300'

        if (iban === null || !ibantools.isValidIBAN(iban)) {
            if (this.ibanRaw.length === 0) {
                if (STAMHOOFD.environment === 'development') {
                    this.ibanRaw = 'BE42631299159354';
                    this.errorBox = new ErrorBox(new SimpleError({
                        code: 'invalid_field',
                        message: $t(`%z0`),
                        field: 'iban',
                    }));
                    return false;
                }
                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`%z1`),
                    field: 'iban',
                }));
            }
            else {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`%z2`) + ' ' + this.ibanRaw,
                    field: 'iban',
                }));
            }

            return false;
        }
        else {
            this.ibanRaw = ibantools.friendlyFormatIBAN(iban) ?? iban;
            this.$emit('update:modelValue', this.ibanRaw);
            this.errorBox = null;
            return true;
        }
    }
}
</script>
