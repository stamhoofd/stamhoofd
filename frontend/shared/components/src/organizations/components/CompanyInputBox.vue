<template>
    <STInputBox class="max">
        <STList>
            <CheckboxListItem v-model="doesNotHaveCompanyNumber" :description="$t('%gI')" :label="$t(`%1CH`)" />
            <CheckboxListItem v-if="hasCompanyNumber" v-model="hasVATNumber" :description="$t('%gJ')" :label="$t(`%gM`)" />
        </STList>
    </STInputBox>

    <div class="split-inputs">
        <div>
            <STInputBox :title="hasCompanyNumber ? $t(`%gN`) : $t(`%gO`)" error-fields="companyName" :error-box="errors.errorBox">
                <input id="business-name" v-model="companyName" class="input" type="text" :placeholder="country === Country.Belgium ? $t(`%gP`) : $t(`%gQ`)" autocomplete="organization">
            </STInputBox>
            <p v-if="hasCompanyNumber && country === Country.Belgium" class="style-description-small">
                {{ $t('%gK') }}
            </p>
        </div>
        <div>
            <CompanyNumberInput v-if="hasCompanyNumber && (!hasVATNumber || country !== Country.Belgium)" v-model="companyNumber" :country="country" :validator="validator" :required="true" :placeholder="$t(`%wa`)" />
            <VATNumberInput v-if="hasVATNumber" v-model="VATNumber" :country="country" :validator="validator" :required="true" :title="$t(`%1CK`)" :placeholder="$t(`%1CK`)" />
        </div>
    </div>

    <div class="split-inputs">
        <div>
            <AddressInput v-model="companyAddress" :required="true" :title="doesNotHaveCompanyNumber ? $t(`%Cn`) : $t(`%gR`)" :validator="validator" />
        </div>
        <EmailInput v-model="administrationEmail" :validator="validator" :required="false" :title="$t(`%gS`)" :placeholder="$t(`%14p`)" />
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import AddressInput from '#inputs/AddressInput.vue';
import CheckboxListItem from '#inputs/CheckboxListItem.vue';
import CompanyNumberInput from '#inputs/CompanyNumberInput.vue';
import EmailInput from '#inputs/EmailInput.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useValidation } from '#errors/useValidation.ts';
import { Validator } from '#errors/Validator.ts';
import VATNumberInput from '#inputs/VATNumberInput.vue';
import { Company, Country } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { useCountry, useEmitPatch } from '../../hooks';

const props = defineProps<{
    company: Company;
    validator: Validator;
}>();

const emit = defineEmits(['patch:company']);
const { addPatch } = useEmitPatch<Company>(props, emit, 'company');
const currentCountry = useCountry();
const errors = useErrors();

useValidation(props.validator, async () => {
    if (hasVATNumber.value && country.value === Country.Belgium && companyNumber.value !== VATNumber.value) {
        companyNumber.value = VATNumber.value;
    }

    if (companyName.value.length < 2) {
        errors.errorBox = new ErrorBox(
            new SimpleError({
                code: 'missing_field',
                field: 'companyName',
                message: $t('%gL'),
            }),
        );
        return false;
    }

    return true;
});

const country = computed(() => companyAddress.value?.country ?? currentCountry.value);
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
            });
        }
        else {
            addPatch({
                companyNumber: '',
            });
        }
    },
});
const doesNotHaveCompanyNumber = computed({
    get: () => !hasCompanyNumber.value,
    set: (value: boolean) => hasCompanyNumber.value = !value,
});

const hasVATNumber = computed({
    get: () => props.company.VATNumber !== null,
    set: (value: boolean) => {
        if (value === (props.company.VATNumber !== null)) {
            return;
        }

        if (!value) {
            addPatch({
                VATNumber: null,
            });
        }
        else {
            addPatch({
                VATNumber: '',
            });
        }
    },
});

const companyName = computed({
    get: () => props.company.name,
    set: (value) => {
        addPatch({
            name: value,
        });
    },
});

const companyAddress = computed({
    get: () => props.company.address,
    set: (value) => {
        addPatch({
            address: value,
        });
    },
});

const companyNumber = computed({
    get: () => props.company.companyNumber,
    set: (value) => {
        addPatch({
            companyNumber: value,
        });
    },
});

const administrationEmail = computed({
    get: () => props.company.administrationEmail,
    set: (value) => {
        addPatch({
            administrationEmail: value,
        });
    },
});

const VATNumber = computed({
    get: () => props.company.VATNumber,
    set: (value) => {
        addPatch({
            VATNumber: value,
            companyNumber: country.value === Country.Belgium ? value : undefined,
        });
    },
});
</script>
