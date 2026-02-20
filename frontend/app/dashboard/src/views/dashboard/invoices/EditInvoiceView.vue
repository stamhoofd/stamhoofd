<template>
    <CategorizedView :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save">
        <p v-if="patched.payments.length > 1 && isNew" class="warning-box">
            {{ $t('a6efcc6f-d148-44ef-b916-8f76dda018e3') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <CategorizedBox icon="company" :title="$t('3c8b07fe-9862-456a-a990-a6da13c2b794')">
            <template #summary>
                <p class="style-description-small">
                    {{ seller.name }}
                </p>
            </template>

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
        </CategorizedBox>

        <CategorizedBox icon="user" :title="$t('Facturatiegegevens')">
            <template v-if="customer" #summary>
                <template v-if="customer.company">
                    <p v-if="customer.company.VATNumber" class="style-description-small">
                        {{ customer.company.VATNumber }} {{ $t('9f72f8ee-74c7-4757-b1dc-948f632114f2') }}
                    </p>
                    <p v-else-if="customer.company.companyNumber" class="style-description-small">
                        {{ customer.company.companyNumber }} {{ $t('d127a845-d79d-4bd5-9335-a302123f56a0') }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('594307a3-05b8-47cf-81e2-59fb6254deba') }}
                    </p>

                    <p v-if="customer.company.address" class="style-description-small">
                        {{ customer.company.address.shortString() }}
                    </p>

                    <p v-if="customer.company.administrationEmail" class="style-description-small">
                        {{ customer.company.administrationEmail }}
                    </p>
                </template>
                <template v-else>
                    <p v-if="customer.phone" class="style-description-small">
                        {{ customer.phone }}
                    </p>

                    <p v-if="!customer.name" class="style-description-small">
                        {{ $t('e20260ab-00a7-4acf-8dc8-938a4c0249d7') }}
                    </p>

                    <p v-if="customer.email && customer.email !== customer.dynamicName" class="style-description-small">
                        {{ customer.email }}
                    </p>

                    <p class="style-description-small">
                        {{ $t('1474bb78-8f01-456a-9e85-c6b1748b76d5') }}
                    </p>
                </template>
            </template>
            <PaymentCustomerSelectionBox :validator="errors.validator" :customer="customer" :customers="suggestedCustomers" @patch:customer="addPatch({customer: $event})" />
        </CategorizedBox>

        <CategorizedBox icon="box" :title="$t('a593d3de-632e-42e1-a9c6-eb54af683907')">
            <template #summary>
                <p class="style-description-small">
                    {{ formatPrice(patched.totalWithVAT) }}
                </p>

                <p class="style-description-small">
                    {{ pluralText(patched.items.length, $t('item'), $t('items')) }}
                </p>
            </template>

            <p v-if="patched.didChangeUnitPricesToCorrectRounding" class="warning-box">
                {{ $t('De eenheidsprijs (excl. BTW) van bepaalde items werd licht aangepast om het afrondingsverschil door BTW-berekeningsregels te verkleinen tegenover het aangerekende bedrag (BTW moet afgerond worden op factuurniveau en niet op lijnniveau).') }}
            </p>
            <InvoiceItemsBox :invoice="patched" />
        </CategorizedBox>
    </CategorizedView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, GeneralSettingsView, RadioListItem, CategorizedView, useAuth, useErrors, usePatch, useRequiredOrganization, PaymentCustomerSelectionBox, CategorizedBox, useContext, Toast } from '@stamhoofd/components';
import { Company, Invoice, PaymentCustomer } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import { InvoiceItemsBox } from './components';
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking';

const props = withDefaults(
    defineProps<{
        invoice: Invoice;
        isNew?: boolean;
        saveHandler?: ((invoice: Invoice) => void) | null;
    }>(), {
        isNew: true,
        saveHandler: null,
    },
);

const { patched, hasChanges, addPatch, patch, reset } = usePatch(props.invoice, {
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
const context = useContext();
const owner = useRequestOwner();
const pop = usePop();

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

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        patched.value.validateVATRates();
        errors.errorBox = null;

        if (!await errors.validator.validate()) {
            return;
        }

        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Invoice>;
        if (props.isNew) {
            arr.addPut(patched.value);
        }
        else {
            arr.addPatch(patch.value);
        }

        // Valid
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/invoices',
            body: arr,
            decoder: new ArrayDecoder(Invoice as Decoder<Invoice>),
            shouldRetry: true,
            owner,
        });

        const updatedValue = response.data[0];
        if (updatedValue) {
            props.invoice.deepSet(updatedValue);
            reset();
        }

        if (props.isNew) {
            Toast.success($t('Een nieuwe factuur werd aangemaakt')).show();
        }
        else {
            Toast.success($t('De factuur werd aangepast')).show();
        }

        props.saveHandler?.(props.invoice);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
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
