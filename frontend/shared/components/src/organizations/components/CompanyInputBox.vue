<template>
    <STList>
        <CheckboxListItem v-model="doesNotHaveCompanyNumber" description="Een feitelijke vereniging is niet geregistreerd en heeft geen ondernemingsnummer" :label="$t(`522b4446-bd3d-4d53-a95a-e82f0de07d5e`)"/>
        <CheckboxListItem v-if="hasCompanyNumber" v-model="hasVATNumber" description="Een VZW is bijna nooit BTW-plichtig" :label="$t(`11ea294f-6d61-47be-9323-67be5614045c`)"/>
    </STList>

    <hr><h2>{{ $t('4596bd3a-5be6-4cd3-a489-8f3a566b9302') }}</h2>

    <div class="split-inputs">
        <div>
            <STInputBox :title="hasCompanyNumber ? $t(`feb0c45c-d58c-4d29-bb85-33d4cd46c568`) : $t(`55ce1ea1-9007-4610-bbee-1612c7f6e4d4`)" error-fields="companyName" :error-box="errors.errorBox">
                <input id="business-name" v-model="companyName" class="input" type="text" :placeholder="country === Country.Belgium ? $t(`4d67bc84-bf5a-475b-853b-17e74ee71c82`) : $t(`8f2d65a9-e0ac-4d5f-b906-9fd46837467a`)" autocomplete="organization"></STInputBox>
            <p v-if="hasCompanyNumber && country === Country.Belgium" class="style-description-small">
                {{ $t('9d986006-058a-42c4-80bd-c423b021bdb3') }}
            </p>
        </div>
        <div>
            <CompanyNumberInput v-if="hasCompanyNumber && (!hasVATNumber || country !== Country.Belgium)" v-model="companyNumber" :country="country" :validator="validator" :required="true" :placeholder="$t(`4657f291-4cdd-4217-9a54-cd9ecec44b0e`)"/>
            <VATNumberInput v-if="hasVATNumber" v-model="VATNumber" :country="country" :validator="validator" :required="true" :title="$t(`a0d13010-dea0-47de-a082-3e42d41fdfb2`)" :placeholder="$t(`a0d13010-dea0-47de-a082-3e42d41fdfb2`)"/>
        </div>
    </div>

    <div class="split-inputs">
        <div>
            <AddressInput v-model="companyAddress" :required="true" :title="doesNotHaveCompanyNumber ? $t(`e6dc987c-457b-4253-9eef-db9ccdb774f1`) : $t(`4765e1b4-fe8d-4cf7-b6ee-106d634c0eaa`)" :validator="validator"/>
        </div>
        <EmailInput v-model="administrationEmail" :validator="validator" :required="false" :title="$t(`cbdbfb69-9c04-4ba2-be0d-c33904ee7ce1`)" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"/>
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { AddressInput, CheckboxListItem, CompanyNumberInput, EmailInput, ErrorBox, useValidation, Validator, VATNumberInput } from '@stamhoofd/components';
import { Company, Country } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { useCountry, useEmitPatch } from '../../hooks';

const props = defineProps<{
    company: Company,
    validator: Validator
}>();

const emit = defineEmits(['patch:company'])
const {addPatch} = useEmitPatch<Company>(props, emit, 'company')
const currentCountry = useCountry()
const errors = useErrors()

useValidation(props.validator, async () => {
    if (hasVATNumber.value && country.value === Country.Belgium && companyNumber.value !== VATNumber.value) {
        companyNumber.value = VATNumber.value
    }

    if (companyName.value.length < 2) {
        errors.errorBox = new ErrorBox(
            new SimpleError({
                code: 'missing_field',
                field: 'companyName',
                message: 'Gelieve een geldige naam in te vullen',
            })
        )
        return false;
    }

    return true;
})

const country = computed(() => companyAddress.value?.country ?? currentCountry.value)
const hasCompanyNumber = computed({
    get: () => props.company.companyNumber !== null,
    set: (value: boolean) => {
        if (value === (props.company.companyNumber !== null)) {
            return;
        }

        if (!value) {
            addPatch({
                companyNumber: null,
                VATNumber: null,
            })
        } else {
            addPatch({
                companyNumber: '',
            })
        }
    }
})
const doesNotHaveCompanyNumber = computed({
    get: () => !hasCompanyNumber.value,
    set: (value: boolean) => hasCompanyNumber.value = !value
})

const hasVATNumber = computed({
    get: () => props.company.VATNumber !== null,
    set: (value: boolean) => {
        if (value === (props.company.VATNumber !== null)) {
            return;
        }

        if (!value) {
            addPatch({
                VATNumber: null,
            })
        } else {
            addPatch({
                VATNumber: '',
            })
        }
    }
})

const companyName = computed({
    get: () => props.company.name,
    set: (value) => {
        addPatch({
            name: value,
        })
    }
})

const companyAddress = computed({
    get: () => props.company.address,
    set: (value) => {
        addPatch({
            address: value,
        })
    }
})

const companyNumber = computed({
    get: () => props.company.companyNumber,
    set: (value) => {
        addPatch({
            companyNumber: value,
        })
    }
})

const administrationEmail = computed({
    get: () => props.company.administrationEmail,
    set: (value) => {
        addPatch({
            administrationEmail: value,
        })
    }
})

const VATNumber = computed({
    get: () => props.company.VATNumber,
    set: (value) => {
        addPatch({
            VATNumber: value,
            companyNumber: country.value === Country.Belgium ? value : undefined,
        })
    }
})
</script>
