<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('2a9075bb-a743-411e-8a3d-94e5e57363f0')" data-submit-last-field :disabled="companies.length === 0" :title="$t(`1db407ec-4d25-40f9-92b9-abf820faaf98`)" @save="goNext">
        <h1>{{ $t('2b09865c-4f3c-44ab-b001-03fc1d5a0ce9') }}</h1>
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
                    {{ $t('1c5b447a-93e8-46da-b6e1-ffc29a2967e8') }}
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
                <span>{{ $t('1310f065-caf5-41e6-a3b8-cf9b39336483') }}</span>
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
                    message: $t(`86ebf633-c9d5-459d-8f7b-259d0d3f2ea4`),
                    field: 'company',
                });
            }

            throw new SimpleError({
                code: 'missing_field',
                message: $t(`9ef6547b-c78a-4d2d-bd2e-75bbbc71e6c7`),
                field: 'company',
            });
        }

        if (customer.company.name.length < 2 || !customer.company.address) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`a562ecf9-00ae-48b7-8568-4e762b11e1f3`),
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
