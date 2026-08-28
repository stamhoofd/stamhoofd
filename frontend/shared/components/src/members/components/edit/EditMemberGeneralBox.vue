<template>
    <div class="container" data-op-ignore data-lpignore="true" data-bwignore="true" data-form-type="other">
        <Title v-bind="$attrs" :title="title" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`%1Os`)">
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
                            <button v-tooltip="$t('%fH')" class="button icon trash small gray" type="button" @click="deleteTrackingYear" />
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

                <PhoneInput v-if="!member.isNew && (isPropertyEnabled('phone') || phone)" v-model="phone" error-fields="phone" :error-box="errors.errorBox" :title="$t('%2k') + lidSuffix " :validator="validator" :required="isPropertyRequired('phone')" :placeholder="isPropertyRequired('phone') ? $t(`%fP`): $t(`%fQ`)" />
                <EmailInput v-if="!(member.isNew) && (isPropertyEnabled('emailAddress') || email) && (!isPropertyEnabled('birthDay') || birthDay)" v-model="email" :required="isPropertyRequired('emailAddress')" :title="$t(`%1FK`) + lidSuffix " :placeholder="isPropertyRequired('emailAddress') ? $t(`%fP`): $t(`%fQ`)" :validator="validator">
                    <template #right>
                        <button v-tooltip="$t('%fI')" class="button icon add small gray" type="button" @click="addEmail" />
                    </template>
                </EmailInput>
                <EmailInput v-for="n in alternativeEmails.length" :key="n" :model-value="getEmail(n - 1)" :required="true" :title="$t(`%fR`) + ' ' + (alternativeEmails.length > 1 ? n : '') " :placeholder="$t(`%fP`)" :validator="validator" @update:model-value="setEmail(n - 1, $event ?? '')">
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
            </div>

            <div v-if="!member.isNew">
                <SelectionAddressInput v-if="address || isPropertyEnabled('address')" v-model="address" :addresses="availableAddresses" :required="isPropertyRequired('address')" :title="$t(`%Cn`) + lidSuffix + (isPropertyRequired('address') ? '' : ' ' + $t(`%br`))" :validator="validator" />

                <STInputBox v-if="isAdmin && !member.isNew && showLanguage" error-fields="language" :error-box="errors.errorBox" :title="$t('%14T')">
                    <Dropdown v-model="language">
                        <option :value="null">
                            {{ $t('%Zni') }}
                        </option>
                        <option v-for="l in availableLanguages" :key="l" :value="l">
                            {{ LanguageHelper.getNativeName(l) }}
                        </option>
                    </Dropdown>
                </STInputBox>
                <p v-if="isAdmin && !member.isNew && showLanguage" class="style-description-small">
                    {{ $t('%Znn') }}
                </p>
            </div>
        </div>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            {{ $t('%1NN', {date: formatDate(reviewDate)}) }}. <button v-tooltip="$t('%fD')" type="button" class="inline-link" @click="clear">
                {{ $t('%fE') }}
            </button>.
        </p>
        <p v-if="!willMarkReviewed && !reviewDate && isAdmin && !member.isNew" class="style-description-small">
            {{ $t('%1NO') }} <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                {{ $t('%jC') }}
            </button>
        </p>

        <div v-if="!member.isNew && (nationalRegisterNumber || isPropertyEnabled('nationalRegisterNumber') )" class="container">
            <hr>
            <h2>{{ $t('Fiscale attesten') }}</h2>

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

            <STList v-if="!member.isNew && isAdmin && isFullAdmin && ((isBelgium && age <= 21 && nationalRegisterNumber && nationalRegisterNumber !== NationalRegisterNumberOptOut) || severeDisability)">
                <CheckboxListItem v-model="severeDisability" :label="$t('Fiscaal attest uitreiken tot hogere leeftijd van 21 jaar', {firstName: firstName})" data-testid="severe-disability-input">
                    <p class="style-description-small">
                        <I18nComponent :t="$t('Enkel voor leden met een attest van zware handicap. <button>Meer info</button>')">
                            <template #button="{content}">
                                <a class="inline-link" href="https://fin.belgium.be/nl/particulieren/belastingvoordelen/kinderopvang/belastingvermindering" target="_blank">
                                    {{ content }}
                                </a>
                            </template>
                        </I18nComponent>
                    </p>
                </CheckboxListItem>
            </STList>
        </div>
    </div>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import type { PlatformMember } from '@stamhoofd/structures';
import { BooleanStatus, Gender, LanguageHelper, NationalRegisterNumberOptOut } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import type { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import BirthDayInput from '../../../inputs/BirthDayInput.vue';
import Dropdown from '../../../inputs/Dropdown.vue';
import EmailInput from '../../../inputs/EmailInput.vue';
import NRNInput from '../../../inputs/NRNInput.vue';
import PhoneInput from '../../../inputs/PhoneInput.vue';
import RadioGroup from '../../../inputs/RadioGroup.vue';
import SelectionAddressInput from '../../../inputs/SelectionAddressInput.vue';
import TrackingYearInput from '../../../inputs/TrackingYearInput.vue';
import { ContextMenu, ContextMenuItem } from '../../../overlays/ContextMenu';
import { useIsPropertyEnabled, useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import Title from './Title.vue';
import { useAuth } from '#hooks/useAuth.ts';
import { Country } from '@stamhoofd/types/Country';
import { useShowMemberLanguage } from '#members/hooks/useShowMemberLanguage.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import CheckboxListItem from '#inputs/CheckboxListItem.vue';
import STList from '#layout/STList.vue';
import { useOrganization } from '#hooks/useOrganization.ts';

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
    parentErrorBox: null,
});

const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true);
const errors = useErrors({ validator: props.validator });
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const auth = useAuth();
const isFullAdmin = auth.hasFullAccess();
const showLanguage = useShowMemberLanguage(computed(() => props.member));
const availableLanguages = I18nController.shared.availableLanguages;

const language = computed({
    get: () => props.member.patchedMember.details.language,
    set: language => props.member.addDetailsPatch({ language }),
});

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
const age = computed(() => {
    return props.member.patchedMember.details.age ?? props.member.patchedMember.details.defaultAge;
});
const organization = useOrganization();

const isBelgium = computed(() => {
    return organization.value?.address.country === Country.Belgium || address.value?.country === Country.Belgium || props.member.patchedMember.details.parents.some(p => p.address && p.address.country === Country.Belgium);
});

const trackingYear = computed({
    get: () => props.member.patchedMember.details.trackingYear,
    set: trackingYear => props.member.addDetailsPatch({ trackingYear }),
});

const severeDisability = computed({
    get: () => props.member.patchedMember.details.severeDisability?.value ?? false,
    set: severeDisability => props.member.addDetailsPatch({ severeDisability:
        BooleanStatus.create({
            value: severeDisability,
        }),
    }),
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
