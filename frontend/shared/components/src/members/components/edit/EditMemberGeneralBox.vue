<template>
    <div class="container">
        <Title v-bind="$attrs" :title="title" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox title="Naam" error-fields="firstName,lastName" :error-box="errors.errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                        </div>
                    </div>
                </STInputBox>

                <BirthDayInput v-if="isPropertyEnabled('birthDay') || birthDay" v-model="birthDay" :title="isPropertyRequired('birthDay') ? 'Geboortedatum' : 'Geboortedatum (optioneel)'" :validator="validator" :required="isPropertyRequired('birthDay')">
                    <template v-if="!trackingYear && isAdmin" #right>
                        <button class="button icon more-horizontal small gray" type="button" @click="showBirthDayMenu" />
                    </template>
                </BirthDayInput>

                <template v-if="isAdmin && trackingYear">
                    <TrackingYearInput v-model="trackingYear" :required="false" :validator="validator">
                        <template #right>
                            <button v-tooltip="'Volgjaar verwijderen'" class="button icon trash small gray" type="button" @click="deleteTrackingYear" />
                        </template>
                    </TrackingYearInput>
                    <p class="style-description-small">
                        {{ $t('3ebf23d3-9609-42b3-b7ae-54bd9c4d08a1') }}
                    </p>
                </template>

                <STInputBox v-if="isPropertyEnabled('gender') || gender !== Gender.Other" title="Identificeert zich als..." error-fields="gender" :error-box="errors.errorBox">
                    <RadioGroup>
                        <Radio v-model="gender" :value="Gender.Male" autocomplete="sex" name="sex">
                            Man
                        </Radio>
                        <Radio v-model="gender" :value="Gender.Female" autocomplete="sex" name="sex">
                            Vrouw
                        </Radio>
                        <Radio v-model="gender" :value="Gender.Other" autocomplete="sex" name="sex">
                            Andere
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <PhoneInput v-if="!member.isNew && (isPropertyEnabled('phone') || phone)" v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34') + lidSuffix " :validator="validator" :required="isPropertyRequired('phone')" :placeholder="isPropertyRequired('phone') ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" />
                <EmailInput v-if="(!member.isNew || birthDay) && (isPropertyEnabled('emailAddress') || email)" v-model="email" :required="isPropertyRequired('emailAddress')" :title="'E-mailadres' + lidSuffix " :placeholder="isPropertyRequired('emailAddress') ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" :validator="validator">
                    <template #right>
                        <button v-tooltip="'Alternatief e-mailadres toevoegen'" class="button icon add small gray" type="button" @click="addEmail" />
                    </template>
                </EmailInput>
                <EmailInput
                    v-for="n in alternativeEmails.length"
                    :key="n"
                    :model-value="getEmail(n - 1)"
                    :required="true"
                    :title="'Alternatief e-mailadres ' + (alternativeEmails.length > 1 ? n : '') "
                    :placeholder="'Enkel van lid zelf'"
                    :validator="validator"
                    @update:model-value="setEmail(n - 1, $event)"
                >
                    <template #right>
                        <button class="button icon trash small gray" type="button" @click="deleteEmail(n - 1)" />
                    </template>
                </EmailInput>
                <div v-if="!member.isNew && (isPropertyEnabled('emailAddress') || email)">
                    <p class="style-description-small">
                        {{ member.patchedMember.firstName }} kan zelf inloggen of registreren op <template v-if="alternativeEmails.length">
                            één van de ingevoerde e-mailadressen.
                        </template><template v-else>
                            het ingevoerde e-mailadres.
                        </template> Daarnaast kan je in één van de volgende stappen één of meerdere ouders toevoegen, met een e-mailadres, die ook toegang krijgen. Vul hier enkel een e-mailadres van {{ member.patchedMember.firstName }} zelf in.
                    </p>
                </div>

                <div v-if="!member.isNew && (nationalRegisterNumber || isPropertyEnabled('nationalRegisterNumber') )">
                    <NRNInput v-model="nationalRegisterNumber" :title="'Rijksregisternummer' + lidSuffix" :required="isPropertyRequired('nationalRegisterNumber')" :nullable="true" :validator="validator" :birth-day="birthDay">
                        <template v-if="!isPropertyEnabled('nationalRegisterNumber')" #right>
                            <button class="button icon trash small gray" type="button" @click="nationalRegisterNumber = null" />
                        </template>
                    </NRNInput>
                    <p v-if="nationalRegisterNumber !== NationalRegisterNumberOptOut" class="style-description-small">
                        Het rijksregisternummer wordt gebruikt om fiscale attesten op te maken. Heeft {{ firstName || 'dit lid' }} geen Belgische nationaliteit, <button class="inline-link" type="button" @click="nationalRegisterNumber = NationalRegisterNumberOptOut">
                            klik dan hier
                        </button>.
                    </p>
                    <p v-else class="style-description-small">
                        Je ontvangt geen fiscale attesten. Toch een Belgische nationaliteit, <button class="inline-link" type="button" @click="nationalRegisterNumber = null">
                            klik dan hier
                        </button>.
                    </p>
                </div>
            </div>

            <div v-if="!member.isNew">
                <SelectionAddressInput v-if="address || isPropertyEnabled('address')" v-model="address" :addresses="availableAddresses" :required="isPropertyRequired('address')" :title="'Adres' + lidSuffix + (isPropertyRequired('address') ? '' : ' (optioneel)')" :validator="validator" />
            </div>
        </div>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            Laatst nagekeken op {{ formatDate(reviewDate) }}. <button v-tooltip="'Het lid zal deze stap terug moeten doorlopen via het ledenportaal'" type="button" class="inline-link" @click="clear">
                Wissen
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
