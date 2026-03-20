<template>
    <STInputBox :title="title" error-fields="password" :error-box="errorBox ?? errors.errorBox" data-testId="password-box">
        <template #right>
            <button v-tooltip="visible ? 'Verberg wachtwoord' : 'Toon wachtwoord'" class="button icon small" :class="visible ? 'eye-off enabled' : 'eye'" type="button" tabindex="-1" @click.prevent="visible = !visible" />
        </template>
        <input
            v-model="passwordRaw"
            name="new-password"
            class="input"
            placeholder="Kies een wachtwoord"
            autocomplete="new-password"
            :type="visible ? 'text' : 'password'"
            data-testId="password-input"
            @input="onInput"
            @change="onChange"
        >
    </STInputBox>
</template>

<script lang="ts" setup>
import type { ErrorBox } from '#errors/ErrorBox';
import { useErrors } from '#errors/useErrors';
import { useValidation } from '#errors/useValidation';
import type { Validator } from '#errors/Validator';
import { onMounted, ref, watch } from 'vue';
import STInputBox from './STInputBox.vue';

const props = withDefaults(defineProps<{ title?: string; validator?: Validator | null; errorBox?: ErrorBox | null; required?: boolean;
    /**
     * Whether the value can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    nullable?: boolean; disabled?: boolean; }>(), {
    title: 'Wachtwoord',
    validator: null,
    errorBox: null,
    required: true,
    nullable: false,
    disabled: false,
});

const visible = ref(false);
const model = defineModel<string | null>({ default: null });
const passwordRaw = ref('');

const errors = useErrors({ validator: props.validator });

useValidation(errors.validator, validate);

watch(model, (val: string | null) => {
    if (val === null) {
        return;
    }
    passwordRaw.value = val;
});

function onInput(event: any) {
    passwordRaw.value = event.currentTarget.value;
    onTyping();
}

function onChange() {
    validate(false);
}

function onTyping() {
    // Silently send value to parents, but don't show visible errors yet
    validate(false, true);
}

onMounted(() => {
    if (props.validator) {
        props.validator.addValidation(this, () => {
            return validate(true);
        });
    }

    passwordRaw.value = model.value ?? '';
});

function validate(final = true, silent = false) {
    passwordRaw.value = passwordRaw.value.trim();

    if (!props.required && (passwordRaw.value.length === 0)) {
        if (!silent) {
            errors.errorBox = null;
        }

        if (model.value !== null) {
            model.value = null;
        }
        return true;
    }

    if (props.required && passwordRaw.value.length === 0 && !final) {
        // Ignore empty if not final
        if (!silent) {
            errors.errorBox = null;
        }

        if (props.nullable && model.value !== null) {
            model.value = null;
        }
        else if (model.value !== '') {
            model.value = '';
        }
        return false;
    }

    if (passwordRaw.value !== model.value) {
        model.value = passwordRaw.value;
    }

    if (!silent) {
        errors.errorBox = null;
    }
    return true;
}
</script>

<style lang="scss">
    .email-input-field {
        // Fix safari bug that shows the autofill on the wrong position
        transform: translate3d(0, 0, 0);
    }
</style>
