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

                <BirthDayInput v-if="isPropertyEnabled('birthDay') || birthDay" v-model="birthDay" :title="isPropertyRequired('birthDay') ? 'Geboortedatum' : 'Geboortedatum (optioneel)'" :validator="validator" :required="isPropertyRequired('birthDay')" />

                <STInputBox v-if="!member.isNew && isPropertyEnabled('gender')" title="Identificeert zich als..." error-fields="gender" :error-box="errors.errorBox">
                    <RadioGroup>
                        <Radio v-model="gender" value="Male" autocomplete="sex" name="sex">
                            Man
                        </Radio>
                        <Radio v-model="gender" value="Female" autocomplete="sex" name="sex">
                            Vrouw
                        </Radio>
                        <Radio v-model="gender" value="Other" autocomplete="sex" name="sex">
                            Andere
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <EmailInput v-if="isPropertyEnabled('emailAddress') || email" v-model="email" :required="isPropertyRequired('emailAddress')" :title="'E-mailadres' + lidSuffix " :placeholder="isPropertyRequired('emailAddress') ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" :validator="validator" />
                <PhoneInput v-if="isPropertyEnabled('phone') || phone" v-model="phone" :title="$t('shared.inputs.mobile.label') + lidSuffix " :validator="validator" :required="isPropertyRequired('phone')" :placeholder="isPropertyRequired('phone') ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" />
            </div>

            <div v-if="!member.isNew">
                <SelectionAddressInput v-if="isPropertyEnabled('address') || address" v-model="address" :addresses="availableAddresses" :required="isPropertyRequired('address')" :title="'Adres' + lidSuffix + (isPropertyRequired('address') ? '' : ' (optioneel)')" :validator="validator" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';

import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { computed } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import BirthDayInput from '../../../inputs/BirthDayInput.vue';
import EmailInput from '../../../inputs/EmailInput.vue';
import PhoneInput from '../../../inputs/PhoneInput.vue';
import RadioGroup from '../../../inputs/RadioGroup.vue';
import SelectionAddressInput from '../../../inputs/SelectionAddressInput.vue';
import { useIsPropertyEnabled, useIsPropertyRequired } from '../../hooks/useIsPropertyRequired';
import Title from './Title.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null
}>()

const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true)
const errors = useErrors({validator: props.validator});

const title = computed(() => {
    if (props.member.isNew) {
        return "Nieuw lid"
    }
    return "Algemeen"
})

useValidation(errors.validator, () => {
    const se = new SimpleErrors()
    if (firstName.value.length < 2) {
        se.addError(new SimpleError({
            code: "invalid_field",
            message: "Vul de voornaam in",
            field: "firstName"
        }))
    }
    if (lastName.value.length < 2) {
        se.addError(new SimpleError({
            code: "invalid_field",
            message: "Vul de achternaam in",
            field: "lastName"
        }))
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se)
        return false
    }
    errors.errorBox = null

    return true
});

const lidSuffix = computed(() => {
    if (firstName.value.length < 2) {
        if (props.member.patchedMember.details.defaultAge < 24) {
            return " van dit lid"
        }
        return ""
    }
    if (props.member.patchedMember.details.defaultAge < 24) {
        return " van "+firstName.value
    }
    return ""
})

const firstName = computed({
    get: () => props.member.patchedMember.details.firstName,
    set: (firstName) => props.member.addDetailsPatch({firstName})
});

const lastName = computed({
    get: () => props.member.patchedMember.details.lastName,
    set: (lastName) => props.member.addDetailsPatch({lastName})
});

const birthDay = computed({
    get: () => props.member.patchedMember.details.birthDay,
    set: (birthDay) => props.member.addDetailsPatch({birthDay})
});

const gender = computed({
    get: () => props.member.patchedMember.details.gender,
    set: (gender) => props.member.addDetailsPatch({gender})
});

const address = computed({
    get: () => props.member.patchedMember.details.address,
    set: (address) => props.member.addDetailsPatch({address})
});

const email = computed({
    get: () => props.member.patchedMember.details.email,
    set: (email) => props.member.addDetailsPatch({email})
});

const phone = computed({
    get: () => props.member.patchedMember.details.phone,
    set: (phone) => props.member.addDetailsPatch({phone})
});

const availableAddresses = computed(() => {
    const list = props.member.family.addresses
    
    if (props.member.patchedMember.details.address !== null && !list.find(a => a.toString() === props.member.patchedMember.details.address!.toString())) {
        list.push(props.member.patchedMember.details.address)
    }
    return list
});

</script>
