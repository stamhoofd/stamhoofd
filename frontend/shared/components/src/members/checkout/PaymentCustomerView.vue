<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" save-text="Doorgaan" data-submit-last-field :disabled="companies.length === 0" @save="goNext" :title="$t(`59da4f9d-b727-4ccd-ab74-219bd84c935b`)">
        <h1>{{ $t('add6177f-a067-4e79-b7b9-aee2070375f6') }}</h1>
        <p>{{ $t('5cdbe0b4-67e8-4935-b870-ca96d3f48924') }}</p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <p v-if="companies.length === 0" class="info-box">
            {{ $t('a11f9b7c-f01e-4cc5-9e63-9230bd1bbd46') }}
        </p>

        <STList v-else>
            <STListItem v-for="company of companies" :key="company.id" :selectable="companies.length > 1" class="right-stack" element-name="label">
                <template #left>
                    <Radio v-if="companies.length > 1" v-model="selectedCompanyId" :value="company.id"/>
                </template>
                <h3 class="style-title-list">
                    {{ company.name || 'Naamloos' }}
                </h3>

                <p v-if="company.VATNumber" class="style-description-small">
                    {{ company.VATNumber }} {{ $t('4023e307-cbc4-48e4-a5dc-277cf74db1e3') }}
                </p>
                <p v-else-if="company.companyNumber" class="style-description-small">
                    {{ company.companyNumber }} {{ $t('de9c4810-ea20-4c8c-9d28-813cfa2fadd4') }}
                </p>
                <p v-else class="style-description-small">
                    {{ $t('522b4446-bd3d-4d53-a95a-e82f0de07d5e') }}
                </p>

                <p v-if="company.address" class="style-description-small">
                    {{ company.address.shortString() }}
                </p>

                <p v-if="company.administrationEmail" class="style-description-small">
                    {{ company.administrationEmail }}
                </p>
            </STListItem>
        </STList>

        <p v-if="auth.hasFullAccess()" class="style-button-bar">
            <button v-if="companies.length === 0" type="button" class="button primary" @click="editInvoiceSettings">
                <span>{{ $t('3b774241-fcc0-4801-81ee-afb7dcd321ae') }}</span>
            </button>
            <button v-else type="button" class="button text" @click="editInvoiceSettings">
                <span class="icon edit"/>
                <span>{{ $t('b0aa62aa-3b40-44dd-b7a3-7f8c752eeb22') }}</span>
            </button>
        </p>
        <p v-else class="warning-box">
            {{ $t('8bc53634-08a5-4404-9455-421955e83ce4') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox, GeneralSettingsView, NavigationActions, STErrorsDefault, useAuth, useErrors, useNavigationActions, useOrganization, useUser } from '@stamhoofd/components';
import { PaymentCustomer, RegisterCheckout } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
    checkout: RegisterCheckout;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
}>();

const errors = useErrors();

const organization = useOrganization();
const loading = ref(false);
const navigate = useNavigationActions();
const user = useUser();
const present = usePresent();
const companies = computed(() => organization.value?.meta.companies ?? []);
const selectedCompanyId = ref<string | null>(companies.value.length > 0 ? companies.value[0].id : null);
const auth = useAuth();

onMounted(() => {
    // Build default value
});

function buildCustomer() {
    return PaymentCustomer.create({
        firstName: user.value?.firstName,
        lastName: user.value?.lastName,
        email: user.value?.email,
        company: companies.value.find(c => c.id === selectedCompanyId.value) ?? (companies.value.length === 1 ? companies.value[0] : null) ?? null,
    });
}

async function editInvoiceSettings() {
    await present({
        components: [
            new ComponentWithProperties(
                GeneralSettingsView,
            ),
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
        const customer = buildCustomer();
        if (!customer.company) {
            if (companies.value.length === 0) {
                throw new SimpleError({
                    code: 'missing_field',
                    message: 'Stel je facturatiegegevens in voor je verder gaat',
                    field: 'company',
                });
            }

            throw new SimpleError({
                code: 'missing_field',
                message: 'Kies de juiste facturatiegegevens voor je verder gaat',
                field: 'company',
            });
        }

        if (customer.company.name.length < 2 || !customer.company.address) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Deze facturatiegegevens zijn niet volledig. Bewerk ze en kijk ze na voor je verder gaat.',
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
