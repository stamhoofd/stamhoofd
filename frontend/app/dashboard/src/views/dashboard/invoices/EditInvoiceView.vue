<template>
    <CategorizedView :title="title" :loading="saving" :disabled="!hasChanges && !isNew" @save="save">
        <p v-if="patched.payments.length > 1 && isNew" class="warning-box">
            {{ $t('%1J0') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <CategorizedBox icon="company" :title="$t('%5M')">
            <template #summary>
                <p class="style-description-small">
                    {{ seller.name }}
                </p>
            </template>

            <STList v-if="companies.length">
                <RadioListItem v-for="company of companies" :key="company.id" v-model="seller" :label="company.name" :value="company">
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
                </RadioListItem>
            </STList>
            <p v-else class="info-box">
                {{ $t('%eR') }}
            </p>

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
        </CategorizedBox>

        <CategorizedBox icon="user" :title="$t('%1Ke')">
            <template v-if="customer" #summary>
                <template v-if="customer.company">
                    <p v-if="customer.company.VATNumber" class="style-description-small">
                        {{ customer.company.VATNumber }} {{ $t('%Gn') }}
                    </p>
                    <p v-else-if="customer.company.companyNumber" class="style-description-small">
                        {{ customer.company.companyNumber }} {{ $t('%eS') }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('%1CH') }}
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
                        {{ $t('%1JF') }}
                    </p>

                    <p v-if="customer.email && customer.email !== customer.dynamicName" class="style-description-small">
                        {{ customer.email }}
                    </p>

                    <p class="style-description-small">
                        {{ $t('%1J8') }}
                    </p>
                </template>
            </template>
            <PaymentCustomerSelectionBox :validator="errors.validator" :customer="customer" :customers="suggestedCustomers" @patch:customer="addPatch({customer: $event})" />
        </CategorizedBox>

        <CategorizedBox icon="box" :title="$t('%1J2')">
            <template #summary>
                <p class="style-description-small">
                    {{ formatPrice(patched.totalWithVAT) }}
                </p>

                <p class="style-description-small">
                    {{ pluralText(patched.items.length, $t('%1Li'), $t('%1Lj')) }}
                </p>
            </template>

            <p v-if="patched.didChangeUnitPricesToCorrectRounding" class="warning-box">
                {{ $t('%1Lk') }}
            </p>
            <InvoiceItemsBox :invoice="patched" />
        </CategorizedBox>
    </CategorizedView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import GeneralSettingsView from '@stamhoofd/components/organizations/GeneralSettingsView.vue';
import RadioListItem from '@stamhoofd/components/inputs/RadioListItem.vue';
import CategorizedView from '@stamhoofd/components/layout/categorized-view/CategorizedView.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import PaymentCustomerSelectionBox from '@stamhoofd/components/payments/components/PaymentCustomerSelectionBox.vue';
import CategorizedBox from '@stamhoofd/components/layout/categorized-view/CategorizedBox.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
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
const title = props.isNew ? $t('%1J4') : $t('%1J5');
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
            Toast.success($t('%1Ll')).show();
        }
        else {
            Toast.success($t('%1Lm')).show();
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
