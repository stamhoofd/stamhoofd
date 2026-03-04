<template>
    <STInputBox
        :title="title"
        :error-fields="errorFields"
        :error-box="errorBoxes"
        :class="props.class"
    >
        <input
            v-model="phoneRaw"
            v-format-input="formatter"
            :placeholder="placeholder"
            autocomplete="mobile tel"
            class="input"
            type="tel"
            :disabled="disabled"
            v-bind="$attrs"
            @change="validate(false)"
            @input="onTyping"
        >
        <template #right>
            <slot name="right" />
        </template>

        <slot />
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
import { AsYouType, parsePhoneNumber } from 'libphonenumber-js/max';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Country, CountryCode, countryCodes, CountryHelper } from '@stamhoofd/structures';

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
        errorFields: 'phone',
        errorBox: null,
    },
);

const errors = useErrors({ validator: props.validator });
const model = defineModel<string | null>({ required: true });

useValidation(errors.validator, validate);

const phoneRaw = ref(model.value ?? '');
const placeholder = computed(() => {
    if (props.placeholder) return props.placeholder;
    if (props.required) return '';
    return $t('07cf8cd9-433f-42e6-8b3a-a5dba83ecc8f');
});

watch(model, (value) => {
    if (value && DataValidator.cleanPhone(value) === DataValidator.cleanPhone(phoneRaw.value)) {
        return;
    }
    phoneRaw.value = value ? value : '';
}, { immediate: true });

watch(() => props.required, (value) => {
    validate(false, true);
}, { immediate: false });

function getDefaultCountry() {
    return I18nController.shared?.countryCode ?? Country.Belgium;
}
function isValid(phone: string, country?: CountryCode) {
    try {
        const phoneNumber = parsePhoneNumber(phone, country ?? getDefaultCountry());

        if (phoneNumber && phoneNumber.isValid()) {
            return true;
        }
    }
    catch (e) {
        console.error(e);
    }
    return false;
}

function formatPhone(phone: string) {
    try {
        const phoneNumber = parsePhoneNumber(phone, getDefaultCountry());

        if (phoneNumber && phoneNumber.isValid()) {
            return phoneNumber.formatInternational();
        }
    }
    catch (e) {
        console.error(e);
    }
    return phone;
}

function formatIncompletePhone(phone: string) {
    try {
        const f = new AsYouType({ defaultCountry: getDefaultCountry() }).input(phone);

        if (f) {
            return f;
        }
    }
    catch (e) {
        console.error(e);
    }
    return phone;
}

const formatter = {
    cleaner: (value: string) => {
        return DataValidator.cleanPhone(value);
    },
    formatter: (value: string) => {
        return formatIncompletePhone(value);
    },
};

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

function onTyping() {
    // Silently send modelValue to parents, but don't show visible errors yet
    validate(false, true);
}

function validate(final = true, silent = false) {
    phoneRaw.value = phoneRaw.value.trim();

    const unformatted = DataValidator.cleanPhone(phoneRaw.value);

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

    if (!isValid(unformatted)) {
        if (!silent) {
            const d = getDefaultCountry();
            for (const country of countryCodes) {
                if (country !== d && isValid(unformatted, country)) {
                    errors.errorBox = new ErrorBox(new SimpleError({
                        code: 'invalid_field',
                        message: $t('deb077c6-7346-413e-b844-c73834e7aa1e', {
                            'country': CountryHelper.getName(d),
                            'other-country': CountryHelper.getName(country),
                        }),
                        field: props.errorFields,
                    }));
                    return false;
                }
            }

            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t('f7cbe04a-3175-4794-8f74-8261a11fbade'),
                field: props.errorFields,
            }));
        }
        return false;
    }
    else {
        const formatted = formatPhone(unformatted);
        if (!silent && formatted !== phoneRaw.value) {
            phoneRaw.value = formatted;
        }
        if (model.value !== formatted) {
            model.value = formatted;
        }
        if (!silent) {
            errors.errorBox = null;
        }
        return true;
    }
}
</script>
