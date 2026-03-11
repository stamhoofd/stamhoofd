<template>
    <div class="container">
        <Title v-bind="$attrs" :title="title" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`%Gq`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" data-testid="first-name-input" type="text" autocomplete="given-name" :placeholder="$t(`%1MT`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" data-testid="last-name-input" type="text" autocomplete="family-name" :placeholder="$t(`%1MU`)">
                        </div>
                    </div>
                </STInputBox>

                <BirthDayInput v-if="isPropertyEnabled('birthDay') || birthDay" v-model="birthDay" :title="isPropertyRequired('birthDay') ? $t(`%17w`) : $t(`%fN`)" :validator="validator" :required="isPropertyRequired('birthDay')">
                    <template v-if="!trackingYear && isAdmin" #right>
                        <button class="button icon more-horizontal small gray" type="button" @click="showBirthDayMenu" />
                    </template>
                </BirthDayInput>

                <template v-if="isAdmin && trackingYear">
                    <TrackingYearInput v-model="trackingYear" :required="false" :validator="validator">
                        <template #right>
                            <button :v-tooltip="$t('%fH')" class="button icon trash small gray" type="button" @click="deleteTrackingYear" />
                        </template>
                    </TrackingYearInput>
                    <p class="style-description-small">
                        {{ $t('%7x') }}
                    </p>
                </template>

                <STInputBox v-if="isPropertyEnabled('gender') || gender !== Gender.Other" error-fields="gender" :error-box="errors.errorBox" :title="$t(`%fO`)">
                    <RadioGroup>
                        <Radio v-model="gender" :value="Gender.Male" autocomplete="sex" name="sex">
                            {{ $t('%XK') }}
                        </Radio>
                        <Radio v-model="gender" :value="Gender.Female" autocomplete="sex" name="sex">
                            {{ $t('%XM') }}
                        </Radio>
                        <Radio v-model="gender" :value="Gender.Other" autocomplete="sex" name="sex">
                            {{ $t('%1JG') }}
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <PhoneInput error-fields="phone" :error-box="errors.errorBox" v-if="!member.isNew && (isPropertyEnabled('phone') || phone)" v-model="phone" :title="$t('%2k') + lidSuffix " :validator="validator" :required="isPropertyRequired('phone')" :placeholder="isPropertyRequired('phone') ? $t(`%fP`): $t(`%fQ`)" />
                <EmailInput v-if="!(member.isNew && isAdmin) && (isPropertyEnabled('emailAddress') || email) && (!isPropertyEnabled('birthDay') || birthDay)" v-model="email" :required="isPropertyRequired('emailAddress')" :title="$t(`%1FK`) + lidSuffix " :placeholder="isPropertyRequired('emailAddress') ? $t(`%fP`): $t(`%fQ`)" :validator="validator">
                    <template #right>
                        <button :v-tooltip="$t('%fI')" class="button icon add small gray" type="button" @click="addEmail" />
                    </template>
                </EmailInput>
                <EmailInput v-for="n in alternativeEmails.length" :key="n" :model-value="getEmail(n - 1)" :required="true" :title="$t(`%fR`) + ' ' + (alternativeEmails.length > 1 ? n : '') " :placeholder="$t(`%fP`)" :validator="validator" @update:model-value="setEmail(n - 1, $event)">
                    <template #right>
                        <button class="button icon trash small gray" type="button" @click="deleteEmail(n - 1)" />
                    </template>
                </EmailInput>
                <div v-if="!member.isNew && (isPropertyEnabled('emailAddress') || email)">
                    <p class="style-description-small">
                        {{ member.patchedMember.firstName }} {{ $t('%fJ') }} <template v-if="alternativeEmails.length">
                            {{ $t('%fK') }}
                        </template><template v-else>
                            {{ $t('%fL') }}
                        </template> {{ $t('%fM', {member: member.patchedMember.firstName}) }}
                    </p>
                </div>

                <div v-if="!member.isNew && (nationalRegisterNumber || isPropertyEnabled('nationalRegisterNumber') )">
                    <NRNInput v-model="nationalRegisterNumber" :title="$t(`%wK`) + lidSuffix + (!isPropertyRequired('nationalRegisterNumber') ? ' ('+$t('%1GF')+')' : '')" :required="isPropertyRequired('nationalRegisterNumber')" :nullable="true" :validator="validator" :birth-day="birthDay">
                        <template v-if="!isPropertyEnabled('nationalRegisterNumber')" #right>
                            <button class="button icon trash small gray" type="button" @click="nationalRegisterNumber = null" />
                        </template>
                    </NRNInput>
                    <p v-if="nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                        <I18nComponent :t="$t('%15M', {firstName: firstName || $t('%15V')})">
                            <template #button="{content}">
                                <button class="inline-link" type="button" @click="nationalRegisterNumber = NationalRegisterNumberOptOut">
                                    {{ content }}
                                </button>
                            </template>
                        </I18nComponent>
                    </p>
                    <p v-else class="style-description-small">
                        <I18nComponent :t="$t('%15N')">
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
                <SelectionAddressInput v-if="address || isPropertyEnabled('address')" v-model="address" :addresses="availableAddresses" :required="isPropertyRequired('address')" :title="$t(`%Cn`) + lidSuffix + (isPropertyRequired('address') ? '' : ' ' + $t(`%br`))" :validator="validator" />
            </div>
        </div>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            {{ $t('%1NN', {date: formatDate(reviewDate)}) }}. <button :v-tooltip="$t('%fD')" type="button" class="inline-link" @click="clear">
                {{ $t('%fE') }}
            </button>.
        </p>
        <p v-if="!willMarkReviewed && !reviewDate && isAdmin" class="style-description-small">
            {{ $t('%1NO') }} <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                {{ $t('%jC') }}
            </button>
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

const props = withDefaults(defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
    willMarkReviewed?: boolean;
}>(), {
    willMarkReviewed: false,
    parentErrorBox: null
});

const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true);
const errors = useErrors({ validator: props.validator });
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';

const title = computed(() => {
    if (props.member.isNew) {
        return $t('%103');
    }
    return $t('%Lb');
});

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (firstName.value.trim().length < 2) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`%uH`),
            field: 'firstName',
        }));
    }
    if (lastName.value.trim().length < 2) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`%104`),
            field: 'lastName',
        }));
    }

    if (phone.value) {
        // Check if duplicate
        const clone = props.member.patchedMember.details.clone();
        clone.cleanData();
        if (clone.phone === null) {
            if (isPropertyRequired('phone')) {
                se.addError(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`%153`, { firstName: props.member.patchedMember.details.firstName }),
                    field: 'phone',
                }));
            } else {
                se.addError(new SimpleError({
                    code: 'invalid_field',
                    message: $t(`%1NP`, { firstName: props.member.patchedMember.details.firstName }),
                    field: 'phone',
                }));
            }
        }
    }

    if (email.value) {
        // Check if duplicate
        const clone = props.member.patchedMember.details.clone();
        clone.cleanData();
        if (clone.email === null) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t(`%154`, { firstName: props.member.patchedMember.details.firstName }),
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
            return ' ' + $t(`%105`);
        }
        return '';
    }
    if (props.member.patchedMember.details.defaultAge < 24) {
        return ' ' + $t(`%155`, { name: firstName.value });
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
            name: $t(`%106`),
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
const now = new Date();

const canMarkReviewed = computed(() => !reviewDate.value || reviewDate.value < now || reviewDate.value);

function clear() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.removeReview('details');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}

function doMarkReviewed() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.markReviewed('details');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}
</script>
