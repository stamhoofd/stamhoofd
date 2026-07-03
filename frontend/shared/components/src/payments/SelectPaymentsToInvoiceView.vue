<template>
    <SaveView :title="title" :disabled="selectedPayments.length === 0" :save-text="$t('%16p')" save-icon-right="arrow-right" @save="goNext">
        <h1>{{ title }}</h1>
        <p>{{ $t('%ZaT') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="hasDifferentCustomers" class="warning-box">
            {{ $t('%ZaZ') }}
        </p>

        <STList>
            <STListItem v-for="payment of payments" :key="payment.id" :selectable="true" element-name="label" :class="payment.theme">
                <template #left>
                    <Checkbox :model-value="isSelected(payment)" @update:model-value="setSelected(payment, $event)" />
                </template>

                <p v-if="payment.type !== PaymentType.Payment" class="style-title-prefix-list">
                    <span>{{ PaymentTypeHelper.getName(payment.type) }}</span>
                </p>

                <h3 class="style-title-list">
                    {{ payment.title }}
                </h3>

                <p v-if="payment.getShortDescription()" class="style-description-small">
                    {{ payment.getShortDescription() }}
                </p>

                <p v-if="payment.paidAt" class="style-description-small">
                    {{ $t('%hr', {date: formatDate(payment.paidAt)}) }}
                </p>
                <p v-else class="style-description-small">
                    {{ $t('%hq', {date: formatDate(payment.createdAt)}) }}
                </p>

                <p v-if="getCustomerDescription(payment)" class="style-description-small">
                    {{ getCustomerDescription(payment) }}
                </p>

                <template #right>
                    <span class="style-price-base" :class="{negative: payment.price < 0}">{{ formatPrice(payment.price) }}</span>
                </template>
            </STListItem>
        </STList>

        <PriceBreakdownBox :price-breakdown="priceBreakdown" />
    </SaveView>
</template>

<script lang="ts" setup>
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useRequiredOrganization } from '#hooks/useOrganization.ts';
import Checkbox from '#inputs/Checkbox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import SaveView from '#navigation/SaveView.vue';
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import { useShow } from '@simonbackx/vue-app-navigation';
import type { PaymentGeneral } from '@stamhoofd/structures';
import { Invoice, PaymentCustomer, PaymentType, PaymentTypeHelper } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        payments: PaymentGeneral[];
        saveHandler?: ((invoice: Invoice) => void) | null;
    }>(), {
        saveHandler: null,
    },
);

const title = $t('%1K2');
const errors = useErrors();
const organization = useRequiredOrganization();
const show = useShow();

const selectedIds = ref(new Set(props.payments.map(p => p.id))) as Ref<Set<string>>;

const selectedPayments = computed(() => props.payments.filter(p => selectedIds.value.has(p.id)));

function isSelected(payment: PaymentGeneral) {
    return selectedIds.value.has(payment.id);
}

function setSelected(payment: PaymentGeneral, selected: boolean) {
    if (selected) {
        selectedIds.value.add(payment.id);
    } else {
        selectedIds.value.delete(payment.id);
    }
}

function getCustomerDescription(payment: PaymentGeneral) {
    if (!payment.customer) {
        return null;
    }
    return payment.customer.company?.name || payment.customer.dynamicName;
}

/**
 * The invoice details (customer) can differ between payments, e.g. between a payment and a
 * later refund after the company details were changed. Warn so the user double checks the customer.
 */
const hasDifferentCustomers = computed(() => {
    const unique = new Set(selectedPayments.value.map((p) => {
        return JSON.stringify({
            vatNumber: p.customer?.company?.VATNumber ?? null,
            companyNumber: p.customer?.company?.companyNumber ?? null,
            name: p.customer?.company?.name ?? p.customer?.name ?? null,
        });
    }));
    return unique.size > 1;
});

const priceBreakdown = computed(() => {
    return [
        {
            name: $t('%ZaS'),
            price: selectedPayments.value.reduce((sum, p) => sum + p.price, 0),
        },
    ];
});

async function goNext() {
    try {
        errors.errorBox = null;

        // Use the customer details of the most recent payment (in case the details changed over time)
        const sorted = selectedPayments.value.slice().sort((a, b) => Sorter.byDateValue(a.paidAt ?? a.createdAt, b.paidAt ?? b.createdAt));
        const customer = sorted.find(p => p.customer)?.customer ?? PaymentCustomer.create({});

        const invoice = Invoice.create({
            seller: organization.value.defaultCompanies[0],
            customer: customer.clone(),
            payments: selectedPayments.value,
        });
        invoice.buildFromPayments();

        await show({
            components: [
                AsyncComponent(() => import('./EditInvoiceView.vue'), {
                    invoice,
                    isNew: true,
                    saveHandler: (invoice: Invoice) => {
                        props.saveHandler?.(invoice);
                    },
                }),
            ],
        });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}
</script>
