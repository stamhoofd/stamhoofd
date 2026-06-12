<template>
    <STInputBox :title="title" error-fields="VATNumber" :error-box="errorBox">
        <input v-model="VATNumberRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" @change="validate">
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { Country } from '@stamhoofd/types/Country';
import { ref, watch } from 'vue';

import { ErrorBox } from "../errors/ErrorBox";
import { useValidation } from '../errors/useValidation';
import type { Validator } from "../errors/Validator";
import STInputBox from "./STInputBox.vue";

const model = defineModel<string | null>({ default: null });

const props = withDefaults(defineProps<{
    country: Country;
    title?: string;
    validator?: Validator | null;
    required?: boolean;
    placeholder?: string;
    autocomplete?: string;
}>(), {
    title: '',
    validator: null,
    required: true,
    placeholder: () => $t(`%zG`),
    autocomplete: () => $t(`%yv`),
});

const VATNumberRaw = ref(model.value ?? '');
const valid = ref(true);
const errorBox = ref<ErrorBox | null>(null);

if (props.validator) {
    useValidation(props.validator, () => validate());
}

watch(model, (val) => {
    if (val === null) {
        return;
    }
    VATNumberRaw.value = val;
});

async function validate() {
    VATNumberRaw.value = VATNumberRaw.value.trim().toUpperCase().replace(/\s/g, " "); // replacement is needed because some apps use non breaking spaces when copying

    if (!props.required && VATNumberRaw.value.length === 0) {
        errorBox.value = null;
        model.value = null;
        return true;
    }

    if (props.required && VATNumberRaw.value.length === 0) {
        errorBox.value = new ErrorBox(new SimpleError({
            "code": "invalid_field",
            "message": $t(`%zH`),
            "field": "VATNumber",
        }));
        return false;
    }

    if (VATNumberRaw.value.length > 2 && VATNumberRaw.value.substr(0, 2) !== props.country.toString()) {
        // Add required country in VAT number
        VATNumberRaw.value = props.country + VATNumberRaw.value;
    }

    const jsvat = await import(/* webpackChunkName: "jsvat-next" */ 'jsvat-next');
    const result = jsvat.checkVAT(VATNumberRaw.value, props.country === Country.Belgium ? [jsvat.belgium] : [jsvat.netherlands]);

    if (!result.isValid) {
        errorBox.value = new ErrorBox(new SimpleError({
            "code": "invalid_field",
            "message": $t(`%zI`) + ' ' + VATNumberRaw.value,
            "field": "VATNumber",
        }));
        return false;
    }
    else {
        VATNumberRaw.value = result.value ?? VATNumberRaw.value;
        model.value = VATNumberRaw.value;
        errorBox.value = null;
        return true;
    }
}
</script>
