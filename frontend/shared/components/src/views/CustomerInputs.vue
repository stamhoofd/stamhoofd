<template>
    <div class="customer-inputs">
        <STInputBox v-if="showName" error-fields="customer.firstName,customer.lastName" :error-box="errorBox" :title="nameTitle">
            <div class="input-group">
                <div>
                    <input v-model="firstName" class="input" name="fname" type="text" required :autocomplete="nameAutocomplete ? 'given-name' : 'off'" :placeholder="$t(`%1MT`)">
                </div>
                <div>
                    <input v-model="lastName" class="input" name="lname" type="text" required :autocomplete="nameAutocomplete ? 'family-name' : 'off'" :placeholder="$t(`%1MU`)">
                </div>
            </div>
        </STInputBox>

        <template v-if="settings.email !== CustomerFieldRequirement.Disabled">
            <EmailInput v-model="email" name="email" :validator="validator" :required="settings.email === CustomerFieldRequirement.Required" :placeholder="emailPlaceholder ?? undefined" autocomplete="email" :title="withOptional($t(`%1FK`), settings.email)" />
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription" />
        </template>

        <PhoneInput v-if="settings.phone !== CustomerFieldRequirement.Disabled" v-model="phone" :title="withOptional($t('%2k'), settings.phone)" name="mobile" :validator="validator" :required="settings.phone === CustomerFieldRequirement.Required" autocomplete="tel" :placeholder="$t(`%Xu`)" />

        <BirthDayInput v-if="settings.birthDay !== CustomerFieldRequirement.Disabled" v-model="birthDay" :title="withOptional($t(`%17w`), settings.birthDay)" :validator="validator" :required="settings.birthDay === CustomerFieldRequirement.Required" />

        <STInputBox v-if="settings.gender !== CustomerFieldRequirement.Disabled" error-fields="customer.gender" :error-box="errorBox" :title="withOptional($t(`%Zd4`), settings.gender)">
            <RadioGroup>
                <Radio v-model="gender" :value="Gender.Male" autocomplete="sex" :name="radioGroupName">
                    {{ $t('%XK') }}
                </Radio>
                <Radio v-model="gender" :value="Gender.Female" autocomplete="sex" :name="radioGroupName">
                    {{ $t('%XM') }}
                </Radio>
                <Radio v-model="gender" :value="Gender.Other" autocomplete="sex" :name="radioGroupName">
                    {{ $t('%1JG') }}
                </Radio>
            </RadioGroup>
        </STInputBox>

        <AddressInput v-if="settings.address !== CustomerFieldRequirement.Disabled" v-model="address" :required="settings.address === CustomerFieldRequirement.Required" :validator="validator" :validate-server="validateServer" :title="withOptional($t(`%Cn`), settings.address)" />
    </div>
</template>

<script lang="ts" setup>
import type { Server } from '@simonbackx/simple-networking';
import type { Address, Customer, ValidatedAddress } from '@stamhoofd/structures';
import { Gender } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
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
    showName?: boolean;
    nameTitle?: string;
    /** Browser autofill of the buyer's own name: off for participants */
    nameAutocomplete?: boolean;
    /** Several customer forms in one page need their own native radio group */
    radioGroupId?: string | null;
    errorBox: ErrorBox | null;
    validator: Validator;
    validateServer?: Server | null;
    emailPlaceholder?: string | null;
    emailDescription?: string | null;
}>(), {
    showName: true,
    nameTitle: () => $t(`%Uy`),
    nameAutocomplete: true,
    radioGroupId: null,
    validateServer: null,
    emailPlaceholder: null,
    emailDescription: null,
});

const emit = defineEmits<{ change: [] }>();

const radioGroupName = computed(() => props.radioGroupId ? 'sex-' + props.radioGroupId : 'sex');

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
