<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('c72a9ab2-98a0-4176-ba9b-86fe009fa755')" data-submit-last-field :disabled="companies.length === 0" :title="$t(`38bea62e-0765-4fbf-a6f3-4e21cc4cc2ef`)" @save="goNext">
        <h1>{{ $t('f777a982-6f69-41cc-bef1-18d146e870db') }}</h1>
        <p>{{ $t('6bc5d58e-d6e4-44fd-a0b1-6f4477457915') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="companies.length === 0" class="info-box">
            {{ $t('b2fbd227-40a3-495d-9826-0e199000cda9') }}
        </p>

        <STList v-else>
            <STListItem v-for="company of companies" :key="company.id" :selectable="companies.length > 1" class="right-stack" element-name="label">
                <template #left>
                    <Radio v-if="companies.length > 1" v-model="selectedCompanyId" :value="company.id" />
                </template>
                <h3 class="style-title-list">
                    {{ company.name || 'Naamloos' }}
                </h3>

                <p v-if="company.VATNumber" class="style-description-small">
                    {{ company.VATNumber }} {{ $t('9f72f8ee-74c7-4757-b1dc-948f632114f2') }}
                </p>
                <p v-else-if="company.companyNumber" class="style-description-small">
                    {{ company.companyNumber }} {{ $t('d127a845-d79d-4bd5-9335-a302123f56a0') }}
                </p>
                <p v-else class="style-description-small">
                    {{ $t('594307a3-05b8-47cf-81e2-59fb6254deba') }}
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
                <span>{{ $t('f624c73d-afc6-4d15-ac75-fc4527dbfef2') }}</span>
            </button>
            <button v-else type="button" class="button text" @click="editInvoiceSettings">
                <span class="icon edit" />
                <span>{{ $t('f31b5c28-56a6-4a21-b1de-dcb4f7f5b6c8') }}</span>
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
                    message: $t(`Stel je facturatiegegevens in voor je verder gaat`),
                    field: 'company',
                });
            }

            throw new SimpleError({
                code: 'missing_field',
                message: $t(`Kies de juiste facturatiegegevens voor je verder gaat`),
                field: 'company',
            });
        }

        if (customer.company.name.length < 2 || !customer.company.address) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`Deze facturatiegegevens zijn niet volledig. Bewerk ze en kijk ze na voor je verder gaat.`),
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
