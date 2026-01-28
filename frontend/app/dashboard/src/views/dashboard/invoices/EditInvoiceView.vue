<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p v-if="patched.payments.length > 1 && isNew" class="warning-box">
            {{ $t('a6efcc6f-d148-44ef-b916-8f76dda018e3') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="container">
            <hr>
            <h2>{{ $t('3c8b07fe-9862-456a-a990-a6da13c2b794') }}</h2>
            <STList v-if="companies.length">
                <RadioListItem v-for="company of companies" :key="company.id" v-model="seller" :label="company.name" :value="company">
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
                </RadioListItem>
            </STList>
            <p v-else class="info-box">
                {{ $t('b2fbd227-40a3-495d-9826-0e199000cda9') }}
            </p>

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
        </div>

        <div class="container">
            <hr>
            <h2>{{ $t('b1ac8856-0f2d-4238-a0f7-1868eebc1df1') }}</h2>

            <CustomerSelectionBox :validator="errors.validator" :customer="customer" :customers="suggestedCustomers" @patch:customer="addPatch({customer: $event})" />
        </div>

        <hr>
        <h2>{{ $t('a593d3de-632e-42e1-a9c6-eb54af683907') }}</h2>

        <STGrid>
            <STGridItem v-for="item of invoice.items" :key="item.id" class="price-grid">
                <template #left>
                    <IconContainer icon="box" />
                </template>

                <h3 class="style-title-list">
                    {{ item.name }}
                </h3>

                <p v-if="item.description" class="style-description-small pre-wrap" v-text="item.description" />

                <p class="style-description-small">
                    {{ $t('22ba722b-947f-42f0-9679-4e965f5b7200', {price: formatPrice(item.unitPrice)}) }}
                </p>

                <template #middleRight>
                    <p class="style-price-base" :class="{negative: item.quantity < 0}">
                        {{ formatFloat(item.quantity / 1_00_00) }}
                    </p>
                </template>

                <template #right>
                    <p class="style-price-base" :class="{negative: item.totalWithoutVAT < 0}">
                        {{ formatPrice(item.totalWithoutVAT) }}
                    </p>
                </template>
            </STGridItem>
        </STGrid>

        <PriceBreakdownBox :price-breakdown="patched.priceBreakdown" />
    </SaveView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, GeneralSettingsView, IconContainer, RadioListItem, SaveView, useAuth, useErrors, usePatch, useRequiredOrganization, PriceBreakdownBox, ErrorBox, STGridItem, STGrid } from '@stamhoofd/components';
import { Company, Invoice, PaymentCustomer } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import CustomerSelectionBox from './components/CustomerSelectionBox.vue';
import { SimpleError } from '@simonbackx/simple-errors';

const props = withDefaults(
    defineProps<{
        invoice: Invoice;
        isNew?: boolean;
    }>(), {
        isNew: true,
    },
);

const { patched, hasChanges, addPatch, patch } = usePatch(props.invoice, {
    postProcess(obj) {
        obj.calculateVAT();
        return obj;
    },
});
const errors = useErrors();
const organization = useRequiredOrganization();
const auth = useAuth();

const saving = ref(false);
const title = props.isNew ? $t('3db5575a-8a20-47ab-807f-fe82ffa3525b') : $t('40ce0817-94a9-4863-9f96-a90e4d09054a');
const companies = computed(() => organization.value.meta.companies);
const present = usePresent();

const seller = computed({
    get: () => patched.value.seller,
    set: (seller: Company) => {
        addPatch({ seller });
    },
});

const customer = computed({
    get: () => patched.value.customer,
    set: (customer: PaymentCustomer) => {
        addPatch(customer);
    },
});

const suggestedCustomers = computed(() => {
    return patched.value.payments.map(p => p.customer).filter(c => !!c);
});

function save() {
    try {
        patched.value.validateVATRates();
        errors.errorBox = null;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
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

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
