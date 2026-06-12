<template>
    <STInputBox :title="title" error-fields="url" :error-box="errorBox">
        <input v-model="urlRaw" class="input" :class="{ error: !valid }" :placeholder="placeholder || $t('%2n')" autocomplete="url" @change="validate(false)" @input="(event: any) => {urlRaw = event.target.value; onTyping();}">
    </STInputBox>
</template>

<script lang="ts" setup>
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
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
    /**
     * Whether the value can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    nullable?: boolean;
    placeholder?: string;
}>(), {
    title: '',
    validator: null,
    required: true,
    nullable: false,
    placeholder: '',
});

const urlRaw = ref(model.value ?? '');
const valid = ref(true);
const errorBox = ref<ErrorBox | null>(null);

if (props.validator) {
    useValidation(props.validator, () => validate(true));
}

watch(model, (val) => {
    if (val === null) {
        urlRaw.value = '';
        return;
    }
    urlRaw.value = val;
});

function onTyping() {
    // Silently send value to parents, but don't show visible errors yet
    validate(false, true);
}

function validate(final: boolean, silent = false) {
    if (urlRaw.value.length === 0) {
        if (!props.required) {
            if (!silent) {
                errorBox.value = null;
            }

            if (model.value !== null) {
                model.value = null;
            }
            return true;
        }

        if (!final) {
            if (!silent) {
                errorBox.value = null;
            }

            if (props.nullable && model.value !== null) {
                model.value = null;
            }
            return false;
        }
    }
    try {
        let autoCorrected = urlRaw.value;

        if (!autoCorrected.startsWith('http://') && !autoCorrected.startsWith('https://')) {
            autoCorrected = 'https://' + autoCorrected;
        }

        try {
            const u = new URL(autoCorrected);
            autoCorrected = u.href;
            if (u.pathname === '/' && autoCorrected[autoCorrected.length - 1] === '/') {
                // Remove trailing slash on root domains (because ugly)
                autoCorrected = autoCorrected.substring(0, autoCorrected.length - 1);
            }
        }
        catch (e) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'url',
                message: 'Invalid url',
                human: $t('%5A').toString(),
            });
        }

        const v = silent ? urlRaw.value : autoCorrected;
        urlRaw.value = v;

        if (model.value !== v) {
            model.value = v;
        }
        if (!silent) {
            errorBox.value = null;
        }
        return true;
    }
    catch (e) {
        console.error(e);
        if (!silent) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                errorBox.value = new ErrorBox(e);
                return false;
            }
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t('%5A').toString(),
                field: 'url',
            }));
        }
        return false;
    }
}
</script>
