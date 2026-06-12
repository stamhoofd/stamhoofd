<template>
    <STInputBox :title="title" error-fields="email" :error-box="errorBox" :class="props.class">
        <input ref="input" v-model="emailRaw" v-autofocus="autofocus" class="email-input-field input" type="email" :class="{ error: !valid }" :disabled="disabled" v-bind="$attrs" data-testid="email-input" @change="validate(false)" @input="(event: any) => {emailRaw = event.currentTarget.value; onTyping();}">
        <template #right>
            <slot name="right" />
        </template>
    </STInputBox>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { DataValidator } from '@stamhoofd/utility';
import { ref, useTemplateRef, watch } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useValidation } from '../errors/useValidation';
import type { Validator } from '../errors/Validator';
import STInputBox from './STInputBox.vue';

// All attributes that we don't recognize should be passed to the input, and not to the root (except style and class)
defineOptions({
    inheritAttrs: false,
});

const model = defineModel<string | null>({ required: true });

const props = withDefaults(defineProps<{
    title?: string;
    validator?: Validator | null;
    class?: string | null;
    required?: boolean;
    /**
     * Whether the modelValue can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    nullable?: boolean;
    disabled?: boolean;
    autofocus?: boolean;
}>(), {
    title: '',
    validator: null,
    class: null,
    required: true,
    nullable: false,
    disabled: false,
    autofocus: false,
});

const emailRaw = ref(model.value ?? '');
const valid = ref(true);
const errorBox = ref<ErrorBox | null>(null);
const inputElement = useTemplateRef<HTMLInputElement>('input');

if (props.validator) {
    useValidation(props.validator, () => validate(true));
}

watch(model, (val) => {
    if (val === null) {
        return;
    }
    emailRaw.value = val;
});

function onTyping() {
    // Silently send modelValue to parents, but don't show visible errors yet
    validate(false, true);
}

function validate(final = true, silent = false) {
    emailRaw.value = emailRaw.value.trim().toLowerCase();

    if (!props.required && emailRaw.value.length === 0) {
        if (!silent) {
            errorBox.value = null;
        }

        if (model.value !== null) {
            model.value = null;
        }
        return true;
    }

    if (props.required && emailRaw.value.length === 0 && !final) {
        // Ignore empty email if not final
        if (!silent) {
            errorBox.value = null;
        }

        if (props.nullable && model.value !== null) {
            model.value = null;
        }
        else if (model.value !== '') {
            model.value = '';
        }
        return false;
    }

    if (!DataValidator.isEmailValid(emailRaw.value)) {
        if (!silent) {
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: emailRaw.value.length === 0 ? $t(`%yy`) : $t(`%1Mi`) + ' ' + emailRaw.value,
                field: 'email',
            }));
        }
        return false;
    }
    else {
        if (emailRaw.value !== model.value) {
            model.value = emailRaw.value;
        }
        if (!silent) {
            errorBox.value = null;
        }
        return true;
    }
}

function focus() {
    inputElement.value?.focus();
}

defineExpose({
    focus,
});
</script>

<style lang="scss">
    .email-input-field {
        // Fix safari bug that shows the autofill on the wrong position
        transform: translate3d(0, 0, 0);
    }
</style>
