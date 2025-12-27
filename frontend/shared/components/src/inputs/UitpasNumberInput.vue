<template>
    <STInputBox
        :title="title"
        :error-fields="errorFields"
        :error-box="errorBoxes"
        :class="props.class"
    >
        <input
            v-model="uitpasNumberRaw"
            v-format-input="DataValidator.getUitpasNumberInputFormatter()"
            :placeholder="placeholder"
            autocomplete="off"
            inputmode="numeric"
            maxlength="16"
            class="input"
            type="text"
            :disabled="disabled"
            v-bind="$attrs"
            @change="validate(false)"
            @input="onTyping"
        >
        <template #right>
            <slot name="right" />
        </template>
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { DataValidator } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import { Validator } from '../errors/Validator';

const props = withDefaults(
    defineProps<{
        validator?: Validator;
        nullable?: boolean;
        title?: string;
        disabled?: boolean;

        class?: string | null;
        required?: boolean;
        placeholder?: string | null;
        errorFields?: string;
        errorBox?: ErrorBox | null;
    }>(), {
        validator: undefined,
        nullable: false,
        title: undefined,
        disabled: false,
        class: null,
        required: true,
        placeholder: null,
        errorFields: 'uitpasNumber',
        errorBox: null,
    },
);

const errors = useErrors({ validator: props.validator });
const model = defineModel<string | null>({ required: true });
const emits = defineEmits<{ (e: 'update:hasErrors', value: boolean): void }>();

useValidation(errors.validator, validate);

const uitpasNumberRaw = ref(model.value ?? '');
const placeholder = computed(() => {
    if (props.placeholder) return props.placeholder;
    const base = $t('5cb71059-9a9c-452c-8957-4622c5dc4af5', { example: '4329 032 984 732' });
    if (props.required) return base;
    return $t('07cf8cd9-433f-42e6-8b3a-a5dba83ecc8f') + '. ' + base;
});

watch(model, (value) => {
    uitpasNumberRaw.value = value ? DataValidator.formatUitpasNumber(value) : '';
}, { immediate: true });

const errorBoxes = computed(() => {
    const arr: ErrorBox[] = [];
    if (props.errorBox) {
        arr.push(props.errorBox);
    }
    if (errors.errorBox) {
        arr.push(errors.errorBox);
    }
    return arr.length > 0 ? arr : null;
});

watch(errorBoxes, (value) => {
    emits('update:hasErrors', value !== null);
}, { immediate: true });

function onTyping() {
    // Silently send modelValue to parents, but don't show visible errors yet
    validate(false, true);
}

function validate(final = true, silent = false) {
    uitpasNumberRaw.value = uitpasNumberRaw.value.trim();

    const unformatted = uitpasNumberRaw.value.replace(/\s+/g, '');

    if (!props.required && unformatted.length === 0) {
        if (!silent) {
            errors.errorBox = null;
        }

        if (model.value !== null) {
            model.value = null;
        }
        return true;
    }

    if (props.required && unformatted.length === 0 && !final) {
        if (!silent) {
            errors.errorBox = null;
        }

        model.value = props.nullable ? null : '';
        return false;
    }

    if (!DataValidator.isUitpasNumberValid(unformatted)) {
        if (!silent) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: unformatted.length === 0
                    ? $t('c2da8c9e-1772-49ad-84e7-c59230a42efa')
                    : $t('6bb156ba-1ab9-40d7-ad72-c71460b2d131'),
                field: props.errorFields,
            }));
        }
        return false;
    }
    else {
        if (model.value !== unformatted) {
            model.value = unformatted;
        }
        if (!silent) {
            errors.errorBox = null;
        }
        return true;
    }
}
</script>
