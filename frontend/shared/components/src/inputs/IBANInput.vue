<template>
    <STInputBox :title="title" error-fields="iban" :error-box="errorBox">
        <input v-model="ibanRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder !== null ? placeholder : $t('%2x')" :autocomplete="autocomplete" @change="validate">
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ref, watch } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useValidation } from '../errors/useValidation';
import type { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

const model = defineModel<string | null>({ default: null });

const props = withDefaults(defineProps<{
    title?: string;
    validator?: Validator | null;
    required?: boolean;
    placeholder?: string | null;
    autocomplete?: string;
}>(), {
    title: '',
    validator: null,
    required: true,
    placeholder: null,
    autocomplete: () => $t(`%16`),
});

const ibanRaw = ref(model.value ?? '');
const valid = ref(true);
const errorBox = ref<ErrorBox | null>(null);

if (props.validator) {
    useValidation(props.validator, () => validate());
}

watch(model, (val) => {
    if (val === null) {
        return;
    }
    ibanRaw.value = val;
});

async function validate() {
    ibanRaw.value = ibanRaw.value.trim().toUpperCase().replace(/\s/g, ' '); // replacement is needed because some apps use non breaking spaces when copying

    if (!props.required && ibanRaw.value.length === 0) {
        errorBox.value = null;
        model.value = null;
        return true;
    }

    const ibantools = await import(/* webpackChunkName: "ibantools" */ 'ibantools');
    const iban = ibantools.electronicFormatIBAN(ibanRaw.value); // 'NL91ABNA0517164300'

    if (iban === null || !ibantools.isValidIBAN(iban)) {
        if (ibanRaw.value.length === 0) {
            if (STAMHOOFD.environment === 'development') {
                ibanRaw.value = 'BE42631299159354';
                errorBox.value = new ErrorBox(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`%z0`),
                    field: 'iban',
                }));
                return false;
            }
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t(`%z1`),
                field: 'iban',
            }));
        }
        else {
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t(`%z2`) + ' ' + ibanRaw.value,
                field: 'iban',
            }));
        }

        return false;
    }
    else {
        ibanRaw.value = ibantools.friendlyFormatIBAN(iban) ?? iban;
        model.value = ibanRaw.value;
        errorBox.value = null;
        return true;
    }
}
</script>
