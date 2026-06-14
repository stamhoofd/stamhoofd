<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :disabled="companies.length === 0 && !editCompany" :title="$t(`%uE`)" @save="goNext">
        <h1>{{ $t('%1Ke') }}</h1>
        <p v-if="invoicesEnabled && !allowNonDefault">
            {{ $t('%1Rd') }}
        </p>
        <p v-else-if="invoicesEnabled">
            {{ $t('%1RH') }}
        </p>
        <p v-else>
            {{ $t('%eQ') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <CompanyInputBox v-if="patchedCompany" :company="patchedCompany" :validator="errors.validator" @patch:company="patchCreateCompany" />
        <template v-else>
            <p v-if="companies.length === 0" class="info-box">
                {{ $t('%eR') }}
            </p>

            <STList v-else-if="allowNonDefault">
                <CompanyRow v-for="(company, index) of companies" :key="company.id" :company="company" :selectable="companies.length > 1" element-name="label" :is-default="index === 0">
                    <template v-if="companies.length > 1" #left>
                        <Radio v-model="selectedCompanyId" :value="company.id" />
                    </template>

                    <template #right>
                        <button v-tooltip="$t('%f9')" type="button" class="button edit icon gray" @click="openEditCompany(company)" />
                    </template>
                </CompanyRow>
            </STList>

            <STList v-else>
                <CompanyRow :company="companies[0]" :selectable="false" :is-default="companies.length > 1">
                    <template #right>
                        <button v-tooltip="$t('%f9')" type="button" class="button edit icon gray" @click="openEditCompany(companies[0])" />
                    </template>
                </CompanyRow>
            </STList>

            <p v-if="auth.hasFullAccess()" class="style-button-bar">
                <button v-if="companies.length === 0" type="button" class="button primary" @click="editInvoiceSettings">
                    <span>{{ $t('%9H') }}</span>
                </button>
                <button v-else-if="!allowNonDefault" type="button" class="button text" @click="editInvoiceSettings">
                    <span class="icon settings small" />
                    <span>{{ $t('%1RW') }}</span>
                </button>
                <button v-else type="button" class="button text" @click="editInvoiceSettings">
                    <span class="icon edit" />
                    <span>{{ $t('%1R3') }}</span>
                </button>
            </p>
            <p v-else class="warning-box">
                {{ $t('%Ac') }}
            </p>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUser } from '#hooks/useUser.ts';
import CompanyInputBox from '#organizations/components/CompanyInputBox.vue';

import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { Checkoutable, RegisterCheckout } from '@stamhoofd/structures';
import { Company, Organization, OrganizationMetaData, PaymentCustomer } from '@stamhoofd/structures';
import { computed, onActivated, onMounted, ref } from 'vue';
import CompanyRow from '../../companies/CompanyRow.vue';

import { usePatchOrganization } from '../../organizations/usePatchOrganization';

const props = withDefaults(
    defineProps<{
        checkout: RegisterCheckout | Checkoutable;
        invoicesEnabled?: boolean;
        allowNonDefault?: boolean;
        saveHandler: (navigate: NavigationActions) => Promise<void>;
    }>(), {
        invoicesEnabled: false,
        allowNonDefault: true
    }
);

const errors = useErrors();

/**
 * Set when editing a company
 */
const editCompany = ref<Company | null>(null);
const patchCompany = ref(Company.patch({}))
function patchCreateCompany(patch: AutoEncoderPatchType<Company>) {
    patchCompany.value = patchCompany.value.patch(patch)
}
const patchedCompany = computed(() => {
    return editCompany.value?.patch(patchCompany.value) ?? null
})

function updateCreateCompany() {
    if (companies.value.length <= 1) {
        if (editCompany.value === null && companies.value.length === 0) {
            // If there is a single company, don't edit by default.
            editCompany.value = organization.value?.defaultCompanies[0] ?? Company.create({})
        }
    } else {
        editCompany.value = null;
    }
}

async function openEditCompany(company: Company) {
    if (!company.id) {
        return;
    }
    await present({
        components: [
            AsyncComponent(() => import('../../organizations/components/EditCompanyView.vue'), {
                company,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<Company>) => {
                    patch.id = company.id;
                    const meta = OrganizationMetaData.patch({});
                    meta.companies.addPatch(patch);
                    await patchOrganization(Organization.patch({meta}));
                }
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

onMounted(updateCreateCompany);
onActivated(updateCreateCompany);

const organization = useOrganization();
const loading = ref(false);
const navigate = useNavigationActions();
const user = useUser();
const present = usePresent();
const companies = computed(() => organization.value?.meta.companies ?? []);
const selectedCompanyId = ref<string | null>(companies.value.length > 0 ? companies.value[0].id : null);
const auth = useAuth();
const patchOrganization = usePatchOrganization();

function buildCustomer() {
    return PaymentCustomer.create({
        firstName: user.value?.firstName,
        lastName: user.value?.lastName,
        email: user.value?.email,
        company: props.allowNonDefault ? (companies.value.find(c => c.id === selectedCompanyId.value) ?? (companies.value.length === 1 ? companies.value[0] : null) ?? null) : companies.value[0] ?? null,
    });
}

async function editInvoiceSettings() {
    await present({
        components: [
            AsyncComponent(() => import('#organizations/GeneralSettingsView.vue'), {}),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function goNext() {
    if (loading.value) {
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        if (!await errors.validator.validate()) {
            return;
        }
        if (editCompany.value) {
            const existing = companies.value.find(c => c.id === editCompany.value!.id);

            // Save this company + set it as the checkout customer
            const meta = OrganizationMetaData.patch({})

            if (existing) {
                patchCompany.value.id = editCompany.value!.id
                meta.companies.addPatch(patchCompany.value);
            } else if (companies.value.length !== 0) {
                console.error('Unexpected creation of company in PaymentCustomerView')
                return
            } else {
                meta.companies.addPut(patchedCompany.value!);
            }

            await patchOrganization(Organization.patch({meta}));
            if ((companies.value.length as number) === 1) {
                selectedCompanyId.value = companies.value[0].id
                editCompany.value = companies.value[0];
                patchCompany.value = Company.patch({})
            } else {
                // Stop edit - choose one to continue
                editCompany.value = null;
                return;
            }
        } 

        const customer = buildCustomer();
        if (!customer.company) {
            if (companies.value.length === 0) {
                throw new SimpleError({
                    code: 'missing_field',
                    message: $t(`%zj`),
                    field: 'company',
                });
            }

            throw new SimpleError({
                code: 'missing_field',
                message: $t(`%zk`),
                field: 'company',
            });
        }

        if (customer.company.name.length < 2 || !customer.company.address) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`%zl`),
                field: 'company',
            });
        }

        props.checkout.customer = customer;
        await props.saveHandler(navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}

</script>
