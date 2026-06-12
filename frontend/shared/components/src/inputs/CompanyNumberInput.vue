<template>
    <STInputBox :title="calculatedTitle" error-fields="companyNumber" :error-box="errorBox">
        <input v-model="companyNumberRaw" class="input" type="text" :class="{ error: !valid }" :placeholder="placeholder" :autocomplete="autocomplete" @change="validate">
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { Country } from '@stamhoofd/types/Country';
import { computed, ref, watch } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useValidation } from '../errors/useValidation';
import type { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

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
    placeholder: () => $t(`%yu`),
    autocomplete: () => $t(`%yv`),
});

const companyNumberRaw = ref(model.value ?? '');
const valid = ref(true);
const errorBox = ref<ErrorBox | null>(null);

const calculatedTitle = computed(() => {
    if (props.title) {
        return props.title;
    }
    if (props.country === Country.Netherlands) {
        return $t(`%yt`);
    }
    return $t(`%wa`);
});

if (props.validator) {
    useValidation(props.validator, () => validate());
}

watch(model, (val) => {
    if (val === null) {
        return;
    }
    companyNumberRaw.value = val;
});

function validate() {
    companyNumberRaw.value = companyNumberRaw.value.trim().toUpperCase().replace(/\s/g, ' '); // replacement is needed because some apps use non breaking spaces when copying

    if (!props.required && companyNumberRaw.value.length === 0) {
        errorBox.value = null;
        model.value = null;
        return true;
    }

    if (companyNumberRaw.value.length === 0) {
        errorBox.value = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: $t(`%yw`),
            field: 'companyNumber',
        }));
        return false;
    }
    else {
        model.value = companyNumberRaw.value;
        errorBox.value = null;
        return true;
    }
}
</script>
