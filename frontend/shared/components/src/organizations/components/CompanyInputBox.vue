<template>
    <STInputBox class="max">
        <STList>
            <CheckboxListItem v-model="doesNotHaveCompanyNumber" :description="$t('becc82f0-4195-4a17-b3f5-03f305582e4a')" :label="$t(`1c5b447a-93e8-46da-b6e1-ffc29a2967e8`)" />
            <CheckboxListItem v-if="hasCompanyNumber" v-model="hasVATNumber" :description="$t('f9c27b43-9514-4e18-94b4-d1abd79ce689')" :label="$t(`9e78c772-0f29-4fb0-8ce6-fe98f9886c01`)" />
        </STList>
    </STInputBox>

    <div class="split-inputs">
        <div>
            <STInputBox :title="hasCompanyNumber ? $t(`9ce72f71-93c0-4c9a-8662-2d673800f82c`) : $t(`8ad6c316-22e5-4fbf-b326-25ce5bf640e1`)" error-fields="companyName" :error-box="errors.errorBox">
                <input id="business-name" v-model="companyName" class="input" type="text" :placeholder="country === Country.Belgium ? $t(`0fd5eadc-ddf0-4962-b7f2-a2dd6dd10c4c`) : $t(`49952c7d-05e9-46a2-b5ec-7411ed71be32`)" autocomplete="organization">
            </STInputBox>
            <p v-if="hasCompanyNumber && country === Country.Belgium" class="style-description-small">
                {{ $t('da259569-5bd1-43bd-a632-fe0b3333443d') }}
            </p>
        </div>
        <div>
            <CompanyNumberInput v-if="hasCompanyNumber && (!hasVATNumber || country !== Country.Belgium)" v-model="companyNumber" :country="country" :validator="validator" :required="true" :placeholder="$t(`12f64ea7-fb54-4178-8267-9de12bdf70d7`)" />
            <VATNumberInput v-if="hasVATNumber" v-model="VATNumber" :country="country" :validator="validator" :required="true" :title="$t(`263b7054-d38f-4bb9-be63-84b4e614613d`)" :placeholder="$t(`263b7054-d38f-4bb9-be63-84b4e614613d`)" />
        </div>
    </div>

    <div class="split-inputs">
        <div>
            <AddressInput v-model="companyAddress" :required="true" :title="doesNotHaveCompanyNumber ? $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`) : $t(`e49699b5-d1bb-4547-8002-08ed2883997c`)" :validator="validator" />
        </div>
        <EmailInput v-model="administrationEmail" :validator="validator" :required="false" :title="$t(`e2a0d0fd-b353-4ac1-8872-a4617fe79e2f`)" :placeholder="$t(`07cf8cd9-433f-42e6-8b3a-a5dba83ecc8f`)" />
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
                message: $t('d16f385c-7a66-446c-8caa-7a7de5cc4073'),
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
