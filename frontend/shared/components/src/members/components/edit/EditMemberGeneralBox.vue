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
                
                <template v-if="!member.isNew">
                    <STInputBox v-if="!member.isNew" title="Identificeert zich als..." error-fields="gender" :error-box="errors.errorBox">
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
                    <PhoneInput v-if="isPropertyEnabled('phone') || phone" v-model="phone" :title="$t('shared.inputs.mobile.label') + lidSuffix " :validator="validator" :required="isPropertyRequired('phone')" :placeholder="isPropertyRequired('phone') ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" />

                    <EmailInput v-if="isPropertyEnabled('emailAddress') || email" v-model="email" :required="isPropertyRequired('emailAddress')" :title="'E-mailadres' + lidSuffix " :placeholder="isPropertyRequired('emailAddress') ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" :validator="validator">
                        <template #right>
                            <button class="button icon add gray" type="button" @click="addEmail" v-tooltip="'Alternatief e-mailadres toevoegen'"/>
                        </template>
                    </EmailInput>
                    <EmailInput 
                        :model-value="getEmail(n - 1)" 
                        @update:modelValue="setEmail(n - 1, ($event as any).target.value)" 
                        :required="true" 
                        :title="'Alternatief e-mailadres ' + (alternativeEmails.length > 1 ? n : '') " 
                        :placeholder="'Enkel van lid zelf'" 
                        :validator="validator"  
                        v-for="n in alternativeEmails.length" 
                        :key="n"
                    >
                        <template #right>
                            <button class="button icon trash gray" type="button" @click="deleteEmail(n - 1)" />
                        </template>
                    </EmailInput>
                    <template v-if="(isPropertyEnabled('emailAddress') || email) && member.patchedMember.details.canHaveOwnAccount">
                        <p class="style-description-small" v-if="member.patchedMember.details.parentsHaveAccess">{{ member.patchedMember.firstName }} kan zelf inloggen of registreren op <template v-if="alternativeEmails.length">één van de ingevoerde e-mailadressen</template><template v-else>het ingevoerde e-mailadres</template>. Daarnaast kan je in één van de volgende stappen één of meerdere ouders toevoegen, met een e-mailadres, die ook toegang krijgen. Vul hier enkel een e-mailadres van {{ member.patchedMember.firstName }} zelf in.</p>
                        <p class="style-description-small" v-else>{{ member.patchedMember.firstName }} kan zelf inloggen of registreren op <template v-if="alternativeEmails.length">één van de ingevoerde e-mailadressen</template><template v-else>het ingevoerde e-mailadres</template>. Vul enkel een e-mailadres van {{ member.patchedMember.firstName }} zelf in.</p>
                    </template>
                </template>
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
import { useAppContext } from '../../../context/appContext';

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
const app = useAppContext()

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

const alternativeEmails = computed({
    get: () => props.member.patchedMember.details.alternativeEmails,
    set: (alternativeEmails) => props.member.addDetailsPatch({
        alternativeEmails: alternativeEmails as any
    })
});

const availableAddresses = computed(() => {
    const list = props.member.family.addresses
    
    if (props.member.patchedMember.details.address !== null && !list.find(a => a.toString() === props.member.patchedMember.details.address!.toString())) {
        list.push(props.member.patchedMember.details.address)
    }
    return list
});

function deleteEmail(n: number) {
    const newEmails = [...alternativeEmails.value];
    newEmails.splice(n, 1);
    alternativeEmails.value = newEmails;
}

function addEmail() {
    alternativeEmails.value = [...alternativeEmails.value, ""];
}

function getEmail(index: number) {
    return alternativeEmails.value[index] ?? "";
}

function setEmail(index: number, value: string) {
    const newEmails = [...alternativeEmails.value];
    newEmails[index] = value;
    alternativeEmails.value = newEmails;
}
</script>
