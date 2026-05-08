<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :disabled="companies.length === 0" :title="$t(`%uE`)" @save="goNext">
        <h1>{{ $t('%1Ke') }}</h1>
        <p v-if="invoicesEnabled">
            {{ $t('Deze gegevens komen op jouw factuur. Zorg dat ze in orde zijn, je kan ze later niet meer wijzigen.') }}
        </p>
        <p v-else>
            {{ $t('%eQ') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="companies.length === 0" class="info-box">
            {{ $t('%eR') }}
        </p>

        <STList v-else>
            <CompanyRow v-for="company of companies" :key="company.id" :company="company" :selectable="companies.length > 1" element-name="label">
                <template v-if="companies.length > 1" #left>
                    <Radio v-model="selectedCompanyId" :value="company.id" />
                </template>
            </CompanyRow>
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
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUser } from '#hooks/useUser.ts';
import GeneralSettingsView from '#organizations/GeneralSettingsView.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import type { Checkoutable, RegisterCheckout } from '@stamhoofd/structures';
import { PaymentCustomer } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import IconContainer from '../../icons/IconContainer.vue';
import CompanyRow from '../../companies/CompanyRow.vue';

const props = withDefaults(
    defineProps<{
        checkout: RegisterCheckout | Checkoutable;
        invoicesEnabled?: boolean;
        saveHandler: (navigate: NavigationActions) => Promise<void>;
    }>(), {
        invoicesEnabled: false,
    }
);

const errors = useErrors();

const organization = useOrganization();
const loading = ref(false);
const navigate = useNavigationActions();
const user = useUser();
const present = usePresent();
const companies = computed(() => organization.value?.meta.companies ?? []);
const selectedCompanyId = ref<string | null>(companies.value.length > 0 ? companies.value[0].id : null);
const auth = useAuth();

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
