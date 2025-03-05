<template>
    <div class="container">
        <Title v-bind="$attrs" :title="title"/>

        <STErrorsDefault :error-box="parentErrorBox"/>
        <STErrorsDefault :error-box="errors.errorBox"/>
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`883f9695-e18f-4df6-8c0d-651c6dd48e59`)"></div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`f89d8bfa-6b5d-444d-a40f-ec17b3f456ee`)"></div>
                    </div>
                </STInputBox>

                <BirthDayInput v-if="isPropertyEnabled('birthDay') || birthDay" v-model="birthDay" :title="isPropertyRequired('birthDay') ? $t(`64bdba26-b42f-4a9a-80f7-9e64b062852c`) : $t(`3c8a3b69-a643-40cb-a6c0-2c74b9500f44`)" :validator="validator" :required="isPropertyRequired('birthDay')">
                    <template v-if="!trackingYear && isAdmin" #right>
                        <button class="button icon more-horizontal small gray" type="button" @click="showBirthDayMenu"/>
                    </template>
                </BirthDayInput>

                <template v-if="isAdmin && trackingYear">
                    <TrackingYearInput v-model="trackingYear" :required="false" :validator="validator">
                        <template #right>
                            <button v-tooltip="'Volgjaar verwijderen'" class="button icon trash small gray" type="button" @click="deleteTrackingYear"/>
                        </template>
                    </TrackingYearInput>
                    <p class="style-description-small">
                        {{ $t('3ebf23d3-9609-42b3-b7ae-54bd9c4d08a1') }}
                    </p>
                </template>

                <STInputBox v-if="isPropertyEnabled('gender') || gender !== Gender.Other" error-fields="gender" :error-box="errors.errorBox" :title="$t(`da97feef-1aeb-405a-9637-67036597805e`)">
                    <RadioGroup>
                        <Radio v-model="gender" :value="Gender.Male" autocomplete="sex" name="sex">
                            {{ $t('733002b7-217f-4917-bad2-a74fabb3c3e9') }}
                        </Radio>
                        <Radio v-model="gender" :value="Gender.Female" autocomplete="sex" name="sex">
                            {{ $t('14d4fedb-fb49-4f81-844c-a14664ce389f') }}
                        </Radio>
                        <Radio v-model="gender" :value="Gender.Other" autocomplete="sex" name="sex">
                            {{ $t('f155bd72-de32-4a15-8627-bd185718a14e') }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <PhoneInput v-if="!member.isNew && (isPropertyEnabled('phone') || phone)" v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34') + lidSuffix " :validator="validator" :required="isPropertyRequired('phone')" :placeholder="isPropertyRequired('phone') ? $t(`a7b55eb1-cade-40dd-81db-d0045a187892`): $t(`2df5a373-2545-4bb7-bf80-0750ae06c7ba`)"/>
                <EmailInput v-if="(!member.isNew || birthDay) && (isPropertyEnabled('emailAddress') || email)" v-model="email" :required="isPropertyRequired('emailAddress')" :title="$t(`0be79160-b242-44dd-94f0-760093f7f9f2`) + lidSuffix " :placeholder="isPropertyRequired('emailAddress') ? $t(`a7b55eb1-cade-40dd-81db-d0045a187892`): $t(`2df5a373-2545-4bb7-bf80-0750ae06c7ba`)" :validator="validator">
                    <template #right>
                        <button v-tooltip="'Alternatief e-mailadres toevoegen'" class="button icon add small gray" type="button" @click="addEmail"/>
                    </template>
                </EmailInput>
                <EmailInput v-for="n in alternativeEmails.length" :key="n" :model-value="getEmail(n - 1)" :required="true" :title="$t(`bfb03263-25f0-41d6-a68d-8946a3a5dd8a`) + ' ' + (alternativeEmails.length > 1 ? n : '') " :placeholder="$t(`a7b55eb1-cade-40dd-81db-d0045a187892`)" :validator="validator" @update:model-value="setEmail(n - 1, $event)">
                    <template #right>
                        <button class="button icon trash small gray" type="button" @click="deleteEmail(n - 1)"/>
                    </template>
                </EmailInput>
                <div v-if="!member.isNew && (isPropertyEnabled('emailAddress') || email) && member.patchedMember.details.canHaveOwnAccount">
                    <p v-if="member.patchedMember.details.parentsHaveAccess" class="style-description-small">
                        {{ member.patchedMember.firstName }} {{ $t('86fec6f3-a092-45b7-8acf-acf850bda840') }} <template v-if="alternativeEmails.length">
                            {{ $t('abaefd64-a9cf-45b6-9ad0-f7d68178e179') }}
                        </template><template v-else>
                            {{ $t('13844a29-c6ea-4a6e-8234-287e6c2228d9') }}
                        </template> {{ $t('4fcaa9e8-f43b-46cd-a2ec-c85f125b5214') }} {{ member.patchedMember.firstName }} {{ $t('f6327d3c-87c1-4b4e-ad4f-0f248213c287') }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ member.patchedMember.firstName }} {{ $t('86fec6f3-a092-45b7-8acf-acf850bda840') }} <template v-if="alternativeEmails.length">
                            {{ $t('3c5deb93-94f1-4104-b690-d805813157e0') }}
                        </template><template v-else>
                            {{ $t('652bf35d-8557-42a8-8307-df3c640346cc') }}
                        </template>{{ $t('f5e394e3-36dd-43ef-ad9d-75eef4ab119e') }} {{ member.patchedMember.firstName }} {{ $t('f6327d3c-87c1-4b4e-ad4f-0f248213c287') }}
                    </p>
                </div>

                <div v-if="!member.isNew && (nationalRegisterNumber || isPropertyEnabled('nationalRegisterNumber') )">
                    <NRNInput v-model="nationalRegisterNumber" :title="$t(`642e4034-71e5-4d00-a6f4-b7dbcc39aac0`) + lidSuffix" :required="isPropertyRequired('nationalRegisterNumber')" :nullable="true" :validator="validator" :birth-day="birthDay"/>
                    <p v-if="nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                        {{ $t('f2a92145-3e48-4bd4-ab7f-c36624cc7f76') }} {{ firstName || 'dit lid' }} {{ $t('db74359d-7094-4e58-ac75-22f3bf318763') }} <button class="inline-link" type="button" @click="nationalRegisterNumber = NationalRegisterNumberOptOut">
                            {{ $t('0af2c851-cf7e-4821-8e18-386150f9b7a8') }}
                        </button>.
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('d8e665a4-2cc3-4787-a83c-6c232bb269c5') }} <button class="inline-link" type="button" @click="nationalRegisterNumber = null">
                            {{ $t('0af2c851-cf7e-4821-8e18-386150f9b7a8') }}
                        </button>.
                    </p>
                </div>
            </div>

            <div v-if="!member.isNew">
                <SelectionAddressInput v-if="address || isPropertyEnabled('address')" v-model="address" :addresses="availableAddresses" :required="isPropertyRequired('address')" :title="$t(`e6dc987c-457b-4253-9eef-db9ccdb774f1`) + lidSuffix + (isPropertyRequired('address') ? '' : ' ' + $t(`6ec5beb6-0b75-4875-8622-11940bbc509b`))" :validator="validator"/>
            </div>
        </div>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            {{ $t('169a6691-dd2e-41a1-b10a-2442330dffbf') }} {{ formatDate(reviewDate) }}. <button v-tooltip="'Het lid zal deze stap terug moeten doorlopen via het ledenportaal'" type="button" class="inline-link" @click="clear">
                {{ $t('56bcb109-f47d-4f8b-8bd5-59cb085096bc') }}
            </button>.
        </p>
    </div>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Gender, NationalRegisterNumberOptOut, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import BirthDayInput from '../../../inputs/BirthDayInput.vue';
import EmailInput from '../../../inputs/EmailInput.vue';
import NRNInput from '../../../inputs/NRNInput.vue';
import PhoneInput from '../../../inputs/PhoneInput.vue';
import RadioGroup from '../../../inputs/RadioGroup.vue';
import SelectionAddressInput from '../../../inputs/SelectionAddressInput.vue';
import TrackingYearInput from '../../../inputs/TrackingYearInput.vue';
import { ContextMenu, ContextMenuItem } from '../../../overlays/ContextMenu';
import { useIsPropertyEnabled, useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
    willMarkReviewed?: boolean;
}>();

const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true);
const errors = useErrors({ validator: props.validator });
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';

const title = computed(() => {
    if (props.member.isNew) {
        return 'Nieuw lid';
    }
    return 'Algemeen';
});

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (firstName.value.trim().length < 2) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Vul de voornaam in',
            field: 'firstName',
        }));
    }
    if (lastName.value.trim().length < 2) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Vul de achternaam in',
            field: 'lastName',
        }));
    }

    if (isPropertyEnabled('phone') && phone.value) {
        // Check if duplicate
        const clone = props.member.patchedMember.details.clone();
        clone.cleanData();
        if (clone.phone === null) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: `Je kan het GSM-nummer van een ouder niet opgeven als het GSM-nummer van ${props.member.patchedMember.details.firstName} of omgekeerd. Vul het GSM-nummer van ${props.member.patchedMember.details.firstName} zelf in.`,
                field: 'phone',
            }));
        }
    }

    if (isPropertyEnabled('emailAddress') && email.value) {
        // Check if duplicate
        const clone = props.member.patchedMember.details.clone();
        clone.cleanData();
        if (clone.email === null) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: `Je kan het e-mailadres van een ouder niet opgeven als het e-mailadres van ${props.member.patchedMember.details.firstName} of omgekeerd. Vul het e-mailadres van ${props.member.patchedMember.details.firstName} zelf in.`,
                field: 'email',
            }));
        }
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }
    errors.errorBox = null;

    return true;
});

const lidSuffix = computed(() => {
    if (firstName.value.length < 2) {
        if (props.member.patchedMember.details.defaultAge < 24) {
            return ' van dit lid';
        }
        return '';
    }
    if (props.member.patchedMember.details.defaultAge < 24) {
        return ' van ' + firstName.value;
    }
    return '';
});

const firstName = computed({
    get: () => props.member.patchedMember.details.firstName,
    set: firstName => props.member.addDetailsPatch({ firstName }),
});

const lastName = computed({
    get: () => props.member.patchedMember.details.lastName,
    set: lastName => props.member.addDetailsPatch({ lastName }),
});

const nationalRegisterNumber = computed({
    get: () => props.member.patchedMember.details.nationalRegisterNumber,
    set: nationalRegisterNumber => props.member.addDetailsPatch({ nationalRegisterNumber }),
});

const birthDay = computed({
    get: () => props.member.patchedMember.details.birthDay,
    set: birthDay => props.member.addDetailsPatch({ birthDay }),
});

const trackingYear = computed({
    get: () => props.member.patchedMember.details.trackingYear,
    set: trackingYear => props.member.addDetailsPatch({ trackingYear }),
});

const gender = computed({
    get: () => props.member.patchedMember.details.gender,
    set: gender => props.member.addDetailsPatch({ gender }),
});

const address = computed({
    get: () => props.member.patchedMember.details.address,
    set: address => props.member.addDetailsPatch({ address }),
});

const email = computed({
    get: () => props.member.patchedMember.details.email,
    set: email => props.member.addDetailsPatch({ email }),
});

const phone = computed({
    get: () => props.member.patchedMember.details.phone,
    set: phone => props.member.addDetailsPatch({ phone }),
});

const alternativeEmails = computed({
    get: () => props.member.patchedMember.details.alternativeEmails,
    set: alternativeEmails => props.member.addDetailsPatch({
        alternativeEmails: alternativeEmails as any,
    }),
});

const availableAddresses = computed(() => {
    const list = props.member.family.addresses;

    if (props.member.patchedMember.details.address !== null && !list.find(a => a.toString() === props.member.patchedMember.details.address!.toString())) {
        list.push(props.member.patchedMember.details.address);
    }
    return list;
});

function deleteEmail(n: number) {
    const newEmails = [...alternativeEmails.value];
    newEmails.splice(n, 1);
    alternativeEmails.value = newEmails;
}

function addEmail() {
    alternativeEmails.value = [...alternativeEmails.value, ''];
}

function getEmail(index: number) {
    return alternativeEmails.value[index] ?? '';
}

function setEmail(index: number, value: string) {
    const newEmails = [...alternativeEmails.value];
    newEmails[index] = value;
    alternativeEmails.value = newEmails;
}

async function showBirthDayMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [new ContextMenuItem({
            name: 'Volgjaar toevoegen',
            action: () => addTrackingYear(),
        })],
    ]);

    await menu.show({
        button: event.currentTarget as HTMLElement,
    });
}

function addTrackingYear() {
    trackingYear.value = (birthDay.value ?? new Date()).getFullYear();
}

function deleteTrackingYear() {
    trackingYear.value = null;
}

const reviewDate = computed(() => {
    return props.member.patchedMember.details.reviewTimes.getLastReview('details');
});

function clear() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.removeReview('details');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}
</script>
