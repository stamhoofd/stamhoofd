<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :disabled="companies.length === 0" :title="$t(`%uE`)" @save="goNext">
        <h1>{{ $t('%1Ke') }}</h1>
        <p>{{ $t('%eQ') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="companies.length === 0" class="info-box">
            {{ $t('%eR') }}
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
                    {{ company.VATNumber }} {{ $t('%Gn') }}
                </p>
                <p v-else-if="company.companyNumber" class="style-description-small">
                    {{ company.companyNumber }} {{ $t('%eS') }}
                </p>
                <p v-else class="style-description-small">
                    {{ $t('%1CH') }}
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
                <span>{{ $t('%9H') }}</span>
            </button>
            <button v-else type="button" class="button text" @click="editInvoiceSettings">
                <span class="icon edit" />
                <span>{{ $t('%eT') }}</span>
            </button>
        </p>
        <p v-else class="warning-box">
            {{ $t('%Ac') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { PaymentCustomer, type RegisterCheckout, type Checkoutable } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import { useAuth } from '#hooks/useAuth.ts';
import { useErrors } from '#errors/useErrors.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { NavigationActions, useNavigationActions } from '#types/NavigationActions.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUser } from '#hooks/useUser.ts';
import GeneralSettingsView from '#organizations/GeneralSettingsView.vue';

const props = defineProps<{
    checkout: RegisterCheckout | Checkoutable<unknown>;
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
