<template>
    <STInputBox :title="title" error-fields="address" :error-box="errorBox">
        <div v-if="cityOnly" class="input-group">
            <input v-model="city" :enterkeyhint="(enterkeyhint as any)" class="input" type="text" :placeholder="$t('%1PP')" name="city" autocomplete="address-level2" data-testid="city-only-input" @change="updateAddress" @input="updateAddressRealTime" @focus="onFocus" @blur="onBlur"> <!-- name needs to be city for safari autocomplete -->
            <Dropdown v-model="country" autocomplete="country" name="country" data-skip-enter-focus data-testid="country-select" @change="updateAddress" @focus="onFocus" @blur="onBlur">
                <option v-for="c in countries" :key="c.value" :value="c.value">
                    {{ c.text }}
                </option>
            </Dropdown>
        </div>

        <template v-else>
            <input v-model="addressLine1" enterkeyhint="next" class="input" type="text" placeholder="Straat en nummer" name="street-address" autocomplete="street-address" @change="updateAddress" @input="updateAddressRealTime" @focus="onFocus" @blur="onBlur">
            <div class="input-group">
                <div>
                    <input v-model="postalCode" enterkeyhint="next" class="input" type="text" placeholder="Postcode" name="postal-code" autocomplete="postal-code" @change="updateAddress" @input="updateAddressRealTime" @focus="onFocus" @blur="onBlur">
                </div>
                <div>
                    <input v-model="city" :enterkeyhint="(enterkeyhint as any)" class="input" type="text" :placeholder="$t('%1PP')" name="city" autocomplete="address-level2" @change="updateAddress" @input="updateAddressRealTime" @focus="onFocus" @blur="onBlur"> <!-- name needs to be city for safari autocomplete -->
                </div>
            </div>
            <Dropdown v-model="country" autocomplete="country" name="country" data-skip-enter-focus @change="updateAddress" @focus="onFocus" @blur="onBlur">
                <option v-for="c in countries" :key="c.value" :value="c.value">
                    {{ c.text }}
                </option>
            </Dropdown>
        </template>
    </STInputBox>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import type { Server } from '@simonbackx/simple-networking';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Address, CountryHelper, ValidatedAddress } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { computed, ref, watch } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useValidation } from '../errors/useValidation';
import type { Validator } from '../errors/Validator';
import Dropdown from './Dropdown.vue';
import STInputBox from './STInputBox.vue';

const model = defineModel<Address | ValidatedAddress | null>({ default: null });

const props = withDefaults(defineProps<{
    title?: string;
    cityOnly?: boolean;
    optionalExceptCity?: boolean;
    /**
     * Assign a validator if you want to offload the validation to components
     */
    validator?: Validator | null;
    /**
     * Validate on the server or not? -> will return a ValidatedAddress if this is true
     */
    validateServer?: Server | null;
    required?: boolean;
    /**
     * Whether the value can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    nullable?: boolean;
    linkCountryToLocale?: boolean;
    enterkeyhint?: string | null;
}>(), {
    title: '',
    cityOnly: false,
    optionalExceptCity: false,
    validator: null,
    validateServer: null,
    required: true,
    nullable: false,
    linkCountryToLocale: false,
    enterkeyhint: null,
});

function getDefaultCountry() {
    return I18nController.shared?.countryCode ?? Country.Belgium;
}

const errorBox = ref<ErrorBox | null>(null);
const pendingErrorBox = ref<ErrorBox | null>(null);

const addressLine1 = ref('');
const city = ref('');
const postalCode = ref('');
const country = ref<Country>(getDefaultCountry());

const hasFocus = ref(false);

const countries = computed(() => CountryHelper.getList());

if (props.validator) {
    useValidation(props.validator, () => isValid(true, false));
}

if (model.value) {
    addressLine1.value = model.value.street.length > 0 ? (model.value.street + ' ' + model.value.number) : (model.value.number + '');
    city.value = model.value.city;
    postalCode.value = model.value.postalCode;
    country.value = model.value.country;
}

watch(model, (val) => {
    if (hasFocus.value) {
        // don't change while typing
        return;
    }

    if (!val) {
        if (!props.required && !pendingErrorBox.value && !errorBox.value) {
            addressLine1.value = '';
            city.value = '';
            postalCode.value = '';
        }
        return;
    }
    addressLine1.value = val.street.length > 0 ? (val.street + ' ' + val.number) : (val.number + '');
    city.value = val.city;
    postalCode.value = val.postalCode;
    country.value = val.country;
}, { deep: true });

watch(() => props.required, () => {
    // Revalidate, because the fields might be empty, and required goes false -> send null so any saved address gets cleared
    isValid(false, true).catch(console.error);
});

function updateValues(val: Address | null) {
    if (!val) {
        if (!props.required && !pendingErrorBox.value && !errorBox.value) {
            addressLine1.value = '';
            city.value = '';
            postalCode.value = '';
        }
        return;
    }
    addressLine1.value = val.street.length > 0 ? (val.street + ' ' + val.number) : (val.number + '');
    city.value = val.city;
    postalCode.value = val.postalCode;
    country.value = val.country;
}

function onBlur() {
    hasFocus.value = false;

    // Sometimes the blur happens without a onChange event, so we always need to update the address after a blur
    // it will only make the errors visible if hasFocus is still false after 200ms
    updateAddress();
}

function onFocus() {
    hasFocus.value = true;
}

async function isValid(isFinal: boolean, silent = false): Promise<boolean> {
    if (!props.required && addressLine1.value.length === 0 && postalCode.value.length === 0 && city.value.length === 0) {
        if (!silent) {
            errorBox.value = null;
        }

        if (model.value !== null) {
            model.value = null;
        }
        return true;
    }

    if (props.required && addressLine1.value.length === 0 && postalCode.value.length === 0 && city.value.length === 0) {
        if (!isFinal) {
            if (!silent) {
                errorBox.value = null;
            }

            if (props.nullable && model.value !== null) {
                model.value = null;
            }
            return false;
        }
    }

    let address: Address;

    try {
        if (!addressLine1.value && (props.optionalExceptCity || props.cityOnly)) {
            address = Address.create({
                street: '',
                number: '',
                postalCode: postalCode.value ?? '',
                city: city.value,
                country: country.value,
            });
            address.cleanData();
        }
        else {
            address = Address.createFromFields(addressLine1.value, postalCode.value, city.value, country.value);
        }

        if (!model.value || (props.validateServer && !(model.value instanceof ValidatedAddress) && !silent && isFinal) || address.toString() !== model.value.toString()) {
            // Do we need to validate on the server?
            if (props.validateServer && !silent && isFinal) {
                const response = await props.validateServer.request({
                    method: 'POST',
                    path: '/address/validate',
                    body: address,
                    decoder: ValidatedAddress as Decoder<ValidatedAddress>,
                    shouldRetry: false,
                });
                if (!hasFocus.value) {
                    updateValues(response.data);
                }
                model.value = response.data;
            }
            else {
                if (!hasFocus.value) {
                    updateValues(address);
                }
                model.value = address;
            }
        }
        else {
            if (!hasFocus.value) {
                updateValues(address);
            }
        }

        if (!silent) {
            errorBox.value = null;
            pendingErrorBox.value = null;
        }
        return true;
    }
    catch (e) {
        if (isSimpleError(e) || isSimpleErrors(e)) {
            e.addNamespace('address');

            if (!silent) {
                if (isFinal) {
                    errorBox.value = new ErrorBox(e);
                }
                else {
                    pendingErrorBox.value = new ErrorBox(e);

                    setTimeout(() => {
                        if (!hasFocus.value) {
                            errorBox.value = pendingErrorBox.value;
                        }
                    }, 200);
                }
            }
        }

        if (!props.required && !silent) {
            model.value = null;
        }
        return false;
    }
}

function updateAddress() {
    if (country.value && props.linkCountryToLocale && I18nController.shared && I18nController.isValidCountry(country.value)) {
        I18nController.shared.switchToLocale({ country: country.value }).catch(console.error);
    }
    isValid(false).catch(console.error);
}

/**
 * Send real time input updates, but don't update error messages
 */
function updateAddressRealTime() {
    if (country.value && props.linkCountryToLocale && I18nController.shared && I18nController.isValidCountry(country.value)) {
        I18nController.shared.switchToLocale({ country: country.value }).catch(console.error);
    }
    isValid(false, true).catch(console.error);
}
</script>
