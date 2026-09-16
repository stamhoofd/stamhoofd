<template>
    <div class="customer-inputs">
        <STInputBox v-if="settings.name !== CustomerFieldRequirement.Disabled" error-fields="customer.firstName,customer.lastName" :error-box="errorBox" :title="withOptional(nameTitle, settings.name)">
            <div class="input-group">
                <div>
                    <input v-model="firstName" class="input" name="fname" type="text" :required="settings.name === CustomerFieldRequirement.Required" :autocomplete="autocomplete('given-name')" :placeholder="$t(`%1MT`)">
                </div>
                <div>
                    <input v-model="lastName" class="input" name="lname" type="text" :required="settings.name === CustomerFieldRequirement.Required" :autocomplete="autocomplete('family-name')" :placeholder="$t(`%1MU`)">
                </div>
            </div>
        </STInputBox>

        <template v-if="settings.email !== CustomerFieldRequirement.Disabled">
            <EmailInput v-model="email" name="email" :validator="validator" :required="settings.email === CustomerFieldRequirement.Required" :placeholder="emailPlaceholder ?? undefined" :autocomplete="autocomplete('email')" :title="withOptional($t(`%1FK`), settings.email)" />
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription" />
        </template>

        <PhoneInput v-if="settings.phone !== CustomerFieldRequirement.Disabled" v-model="phone" :title="withOptional($t('%2k'), settings.phone)" name="mobile" :validator="validator" :required="settings.phone === CustomerFieldRequirement.Required" :autocomplete="autocomplete('tel')" :placeholder="$t(`%Xu`)" />

        <BirthDayInput v-if="settings.birthDay !== CustomerFieldRequirement.Disabled" v-model="birthDay" :title="withOptional($t(`%17w`), settings.birthDay)" :validator="validator" :required="settings.birthDay === CustomerFieldRequirement.Required" />

        <STInputBox v-if="settings.gender !== CustomerFieldRequirement.Disabled" error-fields="customer.gender" :error-box="errorBox" :title="withOptional($t(`%Zd4`), settings.gender)">
            <RadioGroup>
                <Radio v-model="gender" :value="Gender.Male" :autocomplete="autocomplete('sex')" :name="radioGroupName">
                    {{ $t('%XK') }}
                </Radio>
                <Radio v-model="gender" :value="Gender.Female" :autocomplete="autocomplete('sex')" :name="radioGroupName">
                    {{ $t('%XM') }}
                </Radio>
                <Radio v-model="gender" :value="Gender.Other" :autocomplete="autocomplete('sex')" :name="radioGroupName">
                    {{ $t('%1JG') }}
                </Radio>
            </RadioGroup>
        </STInputBox>

        <AddressInput v-if="settings.address !== CustomerFieldRequirement.Disabled" v-model="address" :required="settings.address === CustomerFieldRequirement.Required" :validator="validator" :validate-server="validateServer" :title="withOptional($t(`%Cn`), settings.address)" />
    </div>
</template>

<script lang="ts" setup>
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import type { Address, Customer, ValidatedAddress } from '@stamhoofd/structures';
import { Gender } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { v4 as uuidv4 } from 'uuid';
import { computed } from 'vue';

import type { ErrorBox } from '../errors/ErrorBox';
import type { Validator } from '../errors/Validator';
import AddressInput from '../inputs/AddressInput.vue';
import BirthDayInput from '../inputs/BirthDayInput.vue';
import EmailInput from '../inputs/EmailInput.vue';
import PhoneInput from '../inputs/PhoneInput.vue';
import Radio from '../inputs/Radio.vue';
import RadioGroup from '../inputs/RadioGroup.vue';
import STInputBox from '../inputs/STInputBox.vue';

const props = withDefaults(defineProps<{
    customer: Customer;
    settings: CustomerSettings;
    nameTitle?: string;
    /** Browser autofill: off when the form is about someone other than the visitor */
    enableAutocomplete?: boolean;
    errorBox: ErrorBox | null;
    validator: Validator;
    emailPlaceholder?: string | null;
    emailDescription?: string | null;
}>(), {
    nameTitle: () => $t(`%Uy`),
    enableAutocomplete: true,
    emailPlaceholder: null,
    emailDescription: null,
});

const emit = defineEmits<{ change: [] }>();

// Several customer forms on one page each need their own native radio group
const radioGroupName = 'sex-' + uuidv4();
const validateServer = NetworkManager.server;

function autocomplete(value: string) {
    return props.enableAutocomplete ? value : 'off';
}

function withOptional(title: string, requirement: CustomerFieldRequirement) {
    return requirement === CustomerFieldRequirement.Optional ? title + ' ' + $t('(optioneel)') : title;
}

function field<K extends 'firstName' | 'lastName' | 'email' | 'phone' | 'birthDay' | 'gender' | 'address'>(key: K) {
    return computed({
        get: () => props.customer[key],
        set: (value: Customer[K]) => {
            props.customer[key] = value;
            emit('change');
        },
    });
}

const firstName = field('firstName');
const lastName = field('lastName');
// The inputs emit null for an empty optional value, the structure stores strings
const email = computed({
    get: () => props.customer.email,
    set: (value: string | null) => {
        props.customer.email = value ?? '';
        emit('change');
    },
});
const phone = computed({
    get: () => props.customer.phone,
    set: (value: string | null) => {
        props.customer.phone = value ?? '';
        emit('change');
    },
});
const birthDay = field('birthDay');
const gender = field('gender');
const address = computed({
    get: () => props.customer.address,
    set: (value: Address | ValidatedAddress | null) => {
        props.customer.address = value;
        emit('change');
    },
});
</script>
