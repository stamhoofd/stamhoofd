<template>
    <STInputBox class="max">
        <STList>
            <CheckboxListItem v-model="doesNotHaveCompanyNumber" :description="$t('%gI')" :label="$t(`%1CH`)" />
            <CheckboxListItem v-if="hasCompanyNumber" v-model="hasVATNumber" :description="$t('%gJ')" :label="$t(`%gM`)" />
        </STList>
    </STInputBox>

    <div class="split-inputs">
        <div>
            <STInputBox :title="hasCompanyNumber ? $t(`%gN`) : $t(`%1PW`)" error-fields="companyName" :error-box="errors.errorBox">
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

    <template v-if="canEditPeppol">
        <STInputBox class="max">
            <STList>
                <CheckboxListItem v-model="hasCustomPeppolEndpointId" :label="$t('%ZcR')" :description="!hasCustomPeppolEndpointId && hasVATNumber && company.peppolEndpointId ? $t('%Zch', {peppolId: company.peppolEndpointId.fullId }) : (hasVATNumber ? $t('Hiermee bevestig je zelf een geldig Peppol-ID te hebben ingevuld en ga je akkoord dat we Peppol facturen niet langer via het ondernemingsnummer versturen.') : '')">
                    <div class="option">
                        <div v-if="hasCustomPeppolEndpointId" class="split-inputs">
                            <STInputBox :title="$t('%1LP')">
                                <Dropdown v-model="peppolScheme">
                                    <option v-for="scheme in peppolSchemes" :key="scheme" :value="scheme">
                                        {{ PeppolSchemeHelper.getLongName(scheme) }} ({{ scheme }})
                                    </option>
                                </Dropdown>
                            </STInputBox>
                            <STInputBox :title="$t('%cH')" error-fields="customPeppolEndpointId" :error-box="errors.errorBox">
                                <input v-model="peppolId" class="input" type="text" :placeholder="$t('%ZcV')">
                            </STInputBox>
                        </div>

                        <p v-if="hasCustomPeppolEndpointId && props.company.customPeppolEndpointId?.entityName" class="style-description-small">
                            {{ $t('%Zco', {entityName: props.company.customPeppolEndpointId.entityName}) }}
                        </p>
                    </div>
                </CheckboxListItem>
            </STList>
        </STInputBox>
    </template>
</template>

<script setup lang="ts">
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useValidation } from '#errors/useValidation.ts';
import type { Validator } from '#errors/Validator.ts';
import AddressInput from '#inputs/AddressInput.vue';
import CheckboxListItem from '#inputs/CheckboxListItem.vue';
import CompanyNumberInput from '#inputs/CompanyNumberInput.vue';
import Dropdown from '#inputs/Dropdown.vue';
import EmailInput from '#inputs/EmailInput.vue';
import VATNumberInput from '#inputs/VATNumberInput.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Company } from '@stamhoofd/structures';
import { PeppolEndointId, PeppolScheme, PeppolSchemeHelper } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { computed } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { useContext } from '#hooks/useContext.ts';
import { useCountry } from '#hooks/useCountry.ts';
import { useEmitPatch } from '#hooks/useEmitPatch.ts';

// PEPPOL schemes (ISO 6523 ICD codes) we currently support for a custom endpoint id.
const peppolSchemes = Object.values(PeppolScheme);

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
        } else {
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
        } else {
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

const context = useContext();
// A custom PEPPOL endpoint id may only be set by full platform admins for now.
const canEditPeppol = computed(() => hasCustomPeppolEndpointId.value || (STAMHOOFD.userMode === 'organization' && (!!props.company.companyNumber || !!context.value?.auth?.hasPlatformFullAccess())));

const hasCustomPeppolEndpointId = computed({
    get: () => props.company.customPeppolEndpointId !== null,
    set: (value: boolean) => {
        if (value === (props.company.customPeppolEndpointId !== null)) {
            return;
        }

        addPatch({
            customPeppolEndpointId: value
                ? (props.company.peppolEndpointId ?? PeppolEndointId.create({ schemeID: PeppolScheme.KBO, id: '' }))
                : null,
        });
    },
});

const peppolScheme = computed({
    get: () => props.company.customPeppolEndpointId?.schemeID ?? PeppolScheme.KBO,
    set: (schemeID: string) => {
        addPatch({
            customPeppolEndpointId: PeppolEndointId.create({
                schemeID,
                id: props.company.customPeppolEndpointId?.id ?? '',
            }),
        });
    },
});

const peppolId = computed({
    get: () => props.company.customPeppolEndpointId?.id ?? '',
    set: (id: string) => {
        addPatch({
            customPeppolEndpointId: PeppolEndointId.create({
                schemeID: props.company.customPeppolEndpointId?.schemeID ?? PeppolScheme.KBO,
                id,
            }),
        });
    },
});
</script>
