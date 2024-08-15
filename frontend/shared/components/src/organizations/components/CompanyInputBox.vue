<template>
    <STList>
        <CheckboxListItem v-model="doesNotHaveCompanyNumber" label="Feitelijke vereniging" description="Een feitelijke vereniging is niet geregistreerd en heeft geen ondernemingsnummer" />
        <CheckboxListItem v-if="hasCompanyNumber" v-model="hasVATNumber" label="BTW-plichtig" description="Een VZW is bijna nooit BTW-plichtig" />
    </STList>

    <hr>
    <h2>Gegevens</h2>

    <div class="split-inputs">
        <div>
            <STInputBox :title="hasCompanyNumber ? 'Bedrijfsnaam en rechtsvorm' : 'Naam vereniging'" error-fields="companyName" :error-box="errors.errorBox">
                <input
                    id="business-name"
                    v-model="companyName"
                    class="input"
                    type="text"
                    :placeholder="country === Country.Belgium ? 'bv. Ruimtereis VZW' : 'bv. Ruimtereis vereniging'"
                    autocomplete="organization"
                >
            </STInputBox>
            <p v-if="hasCompanyNumber && country === Country.Belgium" class="style-description-small">
                Vul ook de rechtsvorm in, bv. VZW.
            </p>
        </div>
        <div>
            <CompanyNumberInput v-if="hasCompanyNumber && (!hasVATNumber || country !== Country.Belgium)" v-model="companyNumber" :country="country" placeholder="Ondernemingsnummer" :validator="validator" :required="true" />
            <VATNumberInput v-if="hasVATNumber" v-model="VATNumber" title="BTW-nummer" placeholder="BTW-nummer" :country="country" :validator="validator" :required="true" />
        </div>
    </div>

    <div class="split-inputs">
        <div>
            <AddressInput v-model="companyAddress" :required="true" :title="doesNotHaveCompanyNumber ? 'Adres' : 'Maatschappelijke zetel'" :validator="validator" />
        </div>
        <EmailInput v-model="administrationEmail" title="E-mailadres boekhouding (optioneel)" :validator="validator" :required="false" placeholder="Optioneel" />
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
