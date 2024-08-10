<template>
    <STInputBox :title="title" error-fields="uitpasNumber" :error-box="errorBox" :class="props.class">
        <input ref="input" v-model="uitpasNumberRaw" class="input" type="tel"  :disabled="disabled" v-bind="$attrs" :placeholder="placeholder" autocomplete="off" inputmode="numeric" maxlength="13" @keydown="preventInvalidUitpasNumberChars" @change="validate(false)">
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { DataValidator } from "@stamhoofd/utility";
import { Ref, computed, ref, watch } from 'vue';
import { ErrorBox } from "../errors/ErrorBox";
import { Validator } from "../errors/Validator";
import { useValidation } from '../errors/useValidation';
import STInputBox from "./STInputBox.vue";

const props = withDefaults(defineProps<{
    validator?: Validator,
    nullable?: boolean,
    title?: string,
    disabled?: boolean,
    class?: string,
    required?: boolean
}>(), {
    validator: undefined,
    nullable: false,
    title: undefined,
    disabled: false,
    class: undefined,
    required: true
});

const model = defineModel<string | null>({required: true});

const uitpasNumberRaw = ref(model.value ?? "");

watch(model, (value) => uitpasNumberRaw.value = value ?? '');

const placeholder = computed(() => {
    const base = "Bv. 4329032984732";
    if(props.required) return base;
    return `Optioneel. ${base}`
});

const input = ref<HTMLInputElement | null>(null);
const errorBox: Ref<ErrorBox | null> = ref(null);

if(props.validator) {
    useValidation(props.validator, () => {
        return validate(true)
    });
}

function clearErrorBox(silent: boolean) {
    if (!silent) {
        errorBox.value = null
    }
}

function validate(final = true, silent = false): boolean {
    if (!props.required && uitpasNumberRaw.value.length === 0) {
        clearErrorBox(silent);
        model.value = null;
        return true
    }

    if (props.required && uitpasNumberRaw.value.length === 0 && !final) {
        // Ignore empty email if not final
        clearErrorBox(silent);

        if (props.nullable) {
            model.value = null;
        } else {
            model.value = "";
        }

        return false
    }
        
    if (!DataValidator.isUitpasNumberValid(uitpasNumberRaw.value)) {
        if (!silent) {
            errorBox.value = new ErrorBox(new SimpleError({
                code: "invalid_field",
                message: "Vul een geldig UiTPAS-nummer in",
                field: 'uitpasNumber'
            }));
        }
        
        return false
    }

    model.value = uitpasNumberRaw.value;
    clearErrorBox(silent);

    return true;
}

function preventInvalidUitpasNumberChars(e: KeyboardEvent) {
    // allow paste
    if(e.ctrlKey || e.metaKey) return false;

    // do not allow non-digits
    if(e.key && /^\D$/.test(e.key)) {
        e.preventDefault();
    }
}
</script>
