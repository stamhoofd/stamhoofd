<template>
    <STInputBox :title="title" error-fields="nationalRegisterNumber" :error-box="errors.errorBox" :class="class">
        <input v-if="value === NationalRegisterNumberOptOut" :disabled="true" :value="'Geen Belgische nationaliteit'" class="input">
        <input v-else v-model="nrrRaw" v-format-input="DataValidator.getBelgianNationalNumberInputFormatter()" :placeholder="placeholder || (!required ? 'Optioneel' : 'JJ.MM.DD-XXX.XX')" class="input" type="text" :class="{placeholder: isSuggestion}" :disabled="disabled" v-bind="$attrs" @change="validate(false)" @input="(event: any) => {nrrRaw = event.currentTarget.value; onTyping();}">
        <template #right>
            <slot name="right" />
        </template>
    </STInputBox>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useErrors } from '../errors/useErrors';
import { Validator } from '../errors/Validator';
import { DataValidator } from '@stamhoofd/utility';
import { ErrorBox } from '../errors/ErrorBox';
import { SimpleError } from '@simonbackx/simple-errors';
import { useValidation } from '../errors/useValidation';
import { NationalRegisterNumberOptOut } from '@stamhoofd/structures';

const props = withDefaults(
    defineProps<{
        title: string;
        validator: Validator | null;
        class?: string | null;
        required?: boolean;
        nullable?: boolean;
        disabled?: boolean;
        birthDay?: Date | null;
        placeholder?: string;
    }>(), {
        title: '',
        validator: null,
        class: null,
        required: true,
        nullable: false,
        disabled: false,
        birthDay: null,
        placeholder: '',
    },
);

const errors = useErrors({ validator: props.validator });
const value = defineModel<string | typeof NationalRegisterNumberOptOut | null>();

useValidation(errors.validator, validate);

const nrrRaw = ref(value.value === NationalRegisterNumberOptOut ? '' : (value.value ?? ''));

watch(() => value.value, (val) => {
    if (val === null || val === undefined || val === NationalRegisterNumberOptOut) {
        if (!val) {
            if (props.birthDay && !nrrRaw.value) {
                // Autofill
                nrrRaw.value = suggestion.value ?? '';
            }
        }
        return;
    }
    nrrRaw.value = val;
});

const suggestion = computed(() => {
    if (props.birthDay) {
        return DataValidator.generateBelgianNationalNumber(props.birthDay);
    }
    return null;
});

const isSuggestion = computed(() => {
    return nrrRaw.value === suggestion.value;
});

watch(() => props.birthDay, (val) => {
    if (val && !value.value && !nrrRaw.value) {
        // Autofill
        nrrRaw.value = suggestion.value ?? '';
    }
}, { immediate: true });

function onTyping() {
    // Silently send modelValue to parents, but don't show visible errors yet
    validate(false, true);
}

function validate(final = true, silent = false) {
    if (value.value === NationalRegisterNumberOptOut) {
        if (!silent) {
            errors.errorBox = null;
        }
        return true;
    }

    nrrRaw.value = nrrRaw.value.trim();

    if (!props.required && (nrrRaw.value.length === 0 || nrrRaw.value === suggestion.value)) {
        if (!silent) {
            errors.errorBox = null;
        }

        if (value.value !== null) {
            value.value = null;
        }
        return true;
    }

    if (props.required && nrrRaw.value.length === 0 && !final) {
        // Ignore empty email if not final
        if (!silent) {
            errors.errorBox = null;
        }

        if (props.nullable && value.value !== null) {
            value.value = null;
        }
        else if (value.value !== '') {
            value.value = '';
        }
        return false;
    }

    if (!DataValidator.verifyBelgianNationalNumber(nrrRaw.value)) {
        if (!silent) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: nrrRaw.value.length === 0 ? 'Vul een rijksregisternummer in' : 'Dit is geen geldig rijksregisternummer. Je kan dit nummer vinden op de achterkant van de identiteitskaart, in de vorm van JJ.MM.DD-XXX.XX. Kijk na op typefouten.',
                field: 'nationalRegisterNumber',
            }));
        }
        return false;
    }
    else if (!DataValidator.doesMatchBelgianNationalNumber(nrrRaw.value, props.birthDay)) {
        if (!silent) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: 'Dit rijksregisternummer komt niet overeen met de ingevulde geboortedatum.',
                field: 'nationalRegisterNumber',
            }));
        }
        return false;
    }
    else {
        const formatted = DataValidator.formatBelgianNationalNumber(nrrRaw.value);
        if (formatted !== value.value) {
            value.value = formatted;
        }
        if (!silent) {
            errors.errorBox = null;
        }
        return true;
    }
}
</script>
