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
            return $t(`14d30bea-9ee7-4be6-bb58-4eafe31f8897`);
        }
        return $t(`12f64ea7-fb54-4178-8267-9de12bdf70d7`);
    }

    @Prop({ default: null })
    validator: Validator | null;

    companyNumberRaw = '';
    valid = true;

    @Prop({ default: null })
    modelValue!: string | null;

    @Prop({ default: true })
    required!: boolean;

    @Prop({ default: $t(`13817881-e45b-4aba-a0c8-9cf886fc2de9`) })
    placeholder!: string;

    @Prop({ default: $t(`a0b5e325-c175-4002-a812-4c83e3ce781a`) })
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
                message: $t(`0169f40b-45fd-4552-979d-095381626df1`),
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
