<template>
    <div class="container">
        <Title v-bind="$attrs" :title="title" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" data-testid="first-name-input" type="text" autocomplete="given-name" :placeholder="$t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" data-testid="last-name-input" type="text" autocomplete="family-name" :placeholder="$t(`171bd1df-ed4b-417f-8c5e-0546d948469a`)">
                        </div>
                    </div>
                </STInputBox>

                <BirthDayInput v-if="isPropertyEnabled('birthDay') || birthDay" v-model="birthDay" :title="isPropertyRequired('birthDay') ? $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`) : $t(`a611c2d2-0ac2-430e-8a0f-df2b95bb66cf`)" :validator="validator" :required="isPropertyRequired('birthDay')">
                    <template v-if="!trackingYear && isAdmin" #right>
                        <button class="button icon more-horizontal small gray" type="button" @click="showBirthDayMenu" />
                    </template>
                </BirthDayInput>

                <template v-if="isAdmin && trackingYear">
                    <TrackingYearInput v-model="trackingYear" :required="false" :validator="validator">
                        <template #right>
                            <button :v-tooltip="$t('5086f8ca-8096-4181-9385-efc2148e550b')" class="button icon trash small gray" type="button" @click="deleteTrackingYear" />
                        </template>
                    </TrackingYearInput>
                    <p class="style-description-small">
                        {{ $t('3ebf23d3-9609-42b3-b7ae-54bd9c4d08a1') }}
                    </p>
                </template>

                <STInputBox v-if="isPropertyEnabled('gender') || gender !== Gender.Other" error-fields="gender" :error-box="errors.errorBox" :title="$t(`0cec2d36-929c-4359-8116-d905c5d0074c`)">
                    <RadioGroup>
                        <Radio v-model="gender" :value="Gender.Male" autocomplete="sex" name="sex">
                            {{ $t('b54b9706-4c0c-46a6-9027-37052eb76b28') }}
                        </Radio>
                        <Radio v-model="gender" :value="Gender.Female" autocomplete="sex" name="sex">
                            {{ $t('06466432-eca6-41d0-a3d6-f262f8d6d2ac') }}
                        </Radio>
                        <Radio v-model="gender" :value="Gender.Other" autocomplete="sex" name="sex">
                            {{ $t('8f7475aa-c110-49b2-8017-1a6dd0fe72f9') }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <PhoneInput v-if="!member.isNew && (isPropertyEnabled('phone') || phone)" v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34') + lidSuffix " :validator="validator" :required="isPropertyRequired('phone')" :placeholder="isPropertyRequired('phone') ? $t(`e3d3b76b-e18c-4351-b5af-87186ebabe86`): $t(`17e804e0-5c41-4893-8008-89c7392e1d18`)" />
                <EmailInput v-if="!(member.isNew && isAdmin) && (isPropertyEnabled('emailAddress') || email) && (!isPropertyEnabled('birthDay') || birthDay)" v-model="email" :required="isPropertyRequired('emailAddress')" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`) + lidSuffix " :placeholder="isPropertyRequired('emailAddress') ? $t(`e3d3b76b-e18c-4351-b5af-87186ebabe86`): $t(`17e804e0-5c41-4893-8008-89c7392e1d18`)" :validator="validator">
                    <template #right>
                        <button :v-tooltip="$t('2797d590-7e74-4852-84aa-076f7919a2fb')" class="button icon add small gray" type="button" @click="addEmail" />
                    </template>
                </EmailInput>
                <EmailInput v-for="n in alternativeEmails.length" :key="n" :model-value="getEmail(n - 1)" :required="true" :title="$t(`d11ec0de-3c33-46be-b5fb-09f9e3a9101e`) + ' ' + (alternativeEmails.length > 1 ? n : '') " :placeholder="$t(`e3d3b76b-e18c-4351-b5af-87186ebabe86`)" :validator="validator" @update:model-value="setEmail(n - 1, $event)">
                    <template #right>
                        <button class="button icon trash small gray" type="button" @click="deleteEmail(n - 1)" />
                    </template>
                </EmailInput>
                <div v-if="!member.isNew && (isPropertyEnabled('emailAddress') || email)">
                    <p class="style-description-small">
                        {{ member.patchedMember.firstName }} {{ $t('a64ad874-4655-4a39-87f5-698c9fd47c8a') }} <template v-if="alternativeEmails.length">
                            {{ $t('91fc8702-78ff-4455-9b11-31cda91b4b39') }}
                        </template><template v-else>
                            {{ $t('3ccc6dce-69a4-46d4-8874-8cf8431239f4') }}
                        </template> {{ $t('670684e7-bfa6-48d1-8260-16739b2b47b7', {member: member.patchedMember.firstName}) }}
                    </p>
                </div>

                <div v-if="!member.isNew && (nationalRegisterNumber || isPropertyEnabled('nationalRegisterNumber') )">
                    <NRNInput v-model="nationalRegisterNumber" :title="$t(`439176a5-dd35-476b-8c65-3216560cac2f`) + lidSuffix + (!isPropertyRequired('nationalRegisterNumber') ? ' ('+$t('3e128951-fbcd-4b44-88a3-6c5340ce1dfc')+')' : '')" :required="isPropertyRequired('nationalRegisterNumber')" :nullable="true" :validator="validator" :birth-day="birthDay">
                        <template v-if="!isPropertyEnabled('nationalRegisterNumber')" #right>
                            <button class="button icon trash small gray" type="button" @click="nationalRegisterNumber = null" />
                        </template>
                    </NRNInput>
                    <p v-if="nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                        <I18nComponent :t="$t('0faa16e2-00d5-4427-bfa1-d6b5c9ad4404', {firstName: firstName || $t('9e5a8bc1-91db-44e5-9059-3312f4145525')})">
                            <template #button="{content}">
                                <button class="inline-link" type="button" @click="nationalRegisterNumber = NationalRegisterNumberOptOut">
                                    {{ content }}
                                </button>
                            </template>
                        </I18nComponent>
                    </p>
                    <p v-else class="style-description-small">
                        <I18nComponent :t="$t('00cc0002-1674-47dd-ae92-7547a678bafc')">
                            <template #button="{content}">
                                <button class="inline-link" type="button" @click="nationalRegisterNumber = null">
                                    {{ content }}
                                </button>
                            </template>
                        </I18nComponent>
                    </p>
                </div>
            </div>

            <div v-if="!member.isNew">
                <SelectionAddressInput v-if="address || isPropertyEnabled('address')" v-model="address" :addresses="availableAddresses" :required="isPropertyRequired('address')" :title="$t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`) + lidSuffix + (isPropertyRequired('address') ? '' : ' ' + $t(`49b1c5d0-0511-42f0-a9fe-791572ba96f9`))" :validator="validator" />
            </div>
        </div>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            {{ $t('78dedb37-a33d-4907-8034-43345eea18a0') }} {{ formatDate(reviewDate) }}. <button :v-tooltip="$t('1452c1a3-6203-4ab2-92c4-c0496661cd21')" type="button" class="inline-link" @click="clear">
                {{ $t('74366859-3259-4393-865e-9baa8934327a') }}
            </button>.
        </p>
    </div>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { I18nComponent } from '@stamhoofd/frontend-i18n';
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
        return $t('ce4185d5-0d84-435b-bbd2-ff4a6e2e61c1');
    }
    return $t('43817091-8f0c-41f3-a72b-bcd0a489dfd3');
});

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (firstName.value.trim().length < 2) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`7764f616-f742-4704-93ff-22f1dd31f830`),
            field: 'firstName',
        }));
    }
    if (lastName.value.trim().length < 2) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`bc27bb72-c06d-4a05-8e22-e920d01cc1f4`),
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
                message: $t(`0fd21e1a-8cf1-4155-81bb-726304485ddd`, { firstName: props.member.patchedMember.details.firstName }),
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
                message: $t(`4d1143d6-eae1-4f04-be1b-50ed99182c2a`, { firstName: props.member.patchedMember.details.firstName }),
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
            return ' ' + $t(`a7b59f15-7f75-4dd0-907c-149a46d91c73`);
        }
        return '';
    }
    if (props.member.patchedMember.details.defaultAge < 24) {
        return ' ' + $t(`006efcef-ff11-4003-b8d1-17d735535c05`, { name: firstName.value });
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
    return props.member.family.getAddressesWithoutPatches({ memberId: props.member.id });
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
            name: $t(`542e21b0-662c-42df-b133-7dbb650b8e4f`),
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
