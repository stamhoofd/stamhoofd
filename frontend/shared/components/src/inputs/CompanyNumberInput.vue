<template>
    <STInputBox :title="calculatedTitle" error-fields="companyNumber" :error-box="errorBox">
        <input v-model="companyNumberRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" @change="validate">
    </STInputBox>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';
import { Country } from '@stamhoofd/structures';

import { ErrorBox } from '../errors/ErrorBox';
import { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
    },
})
export default class CompanyNumberInput extends VueComponent {
    @Prop({ required: true })
    country!: Country;

    @Prop({ default: '' })
    title: string;

    get calculatedTitle() {
        if (this.title) {
            return this.title;
        }
        if (this.country === Country.Netherlands) {
            return 'KVK-nummer';
        }
        return 'Ondernemingsnummer';
    }

    @Prop({ default: null })
    validator: Validator | null;

    companyNumberRaw = '';
    valid = true;

    @Prop({ default: null })
    modelValue!: string | null;

    @Prop({ default: true })
    required!: boolean;

    @Prop({ default: 'Vul jouw ondernemingsnummer hier in' })
    placeholder!: string;

    @Prop({ default: 'vat number' })
    autocomplete!: string;

    errorBox: ErrorBox | null = null;

    @Watch('modelValue')
    onValueChanged(val: string | null) {
        if (val === null) {
            return;
        }
        this.companyNumberRaw = val;
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate();
            });
        }

        this.companyNumberRaw = this.modelValue ?? '';
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this);
        }
    }

    validate() {
        this.companyNumberRaw = this.companyNumberRaw.trim().toUpperCase().replace(/\s/g, ' '); // replacement is needed because some apps use non breaking spaces when copying

        if (!this.required && this.companyNumberRaw.length === 0) {
            this.errorBox = null;
            this.$emit('update:modelValue', null);
            return true;
        }

        if (this.companyNumberRaw.length === 0) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: 'Verplicht in te vullen',
                field: 'companyNumber',
            }));
            return false;
        }
        else {
            this.$emit('update:modelValue', this.companyNumberRaw);
            this.errorBox = null;
            return true;
        }
    }
}
</script>
