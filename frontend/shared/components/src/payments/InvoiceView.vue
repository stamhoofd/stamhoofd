<template>
    <div class="st-view invoice-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="invoice.xml && invoice.pdf" v-tooltip="'Download PDF in plaats van XML (niet officieel)'" type="button" class="button icon color-pdf file-pdf" @click="downloadInvoicePdf(invoice)" />
                <button v-if="invoice.xml || invoice.pdf" type="button" class="button icon download gray" @click="downloadInvoice(invoice)" />

                <button v-if="hasPrevious || hasNext" v-tooltip="$t('%hA')" type="button" class="button icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="$t('%hB')" type="button" class="button icon arrow-down" :disabled="!hasNext" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <p :class="'style-title-prefix ' + invoice.theme">
                {{ capitalizeFirstLetter(InvoiceTypeHelper.getName(invoice.type)) }} <span v-copyable class="style-copyable">{{ title }}</span>
            </p>

            <h1 class="style-navigation-title with-icons">
                {{ invoice.customer?.dynamicName }}
            </h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="invoice.number && !invoice.pdf" class="error-box selectable with-button">
                {{ $t('%Zgg') }}

                <LoadingButton class="button text" type="button" :loading="isRetrying" @click="retrySending">
                    {{ $t('%1EU') }}
                </LoadingButton>
            </p>

            <dl class="details-grid">
                <template v-if="invoice.invoicedAt">
                    <dt>{{ $t('%7R') }}</dt>
                    <dd>
                        <span v-copyable class="style-copyable">{{ formatDate(invoice.invoicedAt) }}</span>
                    </dd>
                </template>
                <template v-if="invoice.dueAt">
                    <dt>{{ $t('%1J7') }}</dt>
                    <dd>
                        <span v-copyable class="style-copyable">{{ formatDate(invoice.dueAt) }}</span>
                    </dd>
                </template>
                <template v-if="invoice.comments">
                    <dt>{{ $t('%YT') }}</dt>
                    <dd class="pre-wrap">
                        {{ invoice.comments }}
                    </dd>
                </template>

                <template v-if="invoice.customer">
                    <dt>{{ $t('%1J1') }}</dt>
                    <dd>
                        <p v-copyable class="style-description style-copyable">
                            {{ invoice.customer.dynamicName }}
                        </p>

                        <p v-if="invoice.customer?.company?.VATNumber" v-copyable class="style-description-small style-copyable">
                            {{ Formatter.VATNumber(invoice.customer.company.VATNumber) }}
                        </p>
                        <p v-else-if="invoice.customer?.company?.companyNumber" v-copyable class="style-description-small style-copyable">
                            {{ invoice.customer.company.companyNumber }}
                        </p>
                        <p v-if="invoice.customer?.company?.administrationEmail" class="style-description-small">
                            <EmailAddress :email="invoice.customer.company.administrationEmail" />
                        </p>
                        <p v-if="invoice.customer?.company?.customPeppolEndpointId" v-copyable class="style-description-small style-copyable">
                            {{ invoice.customer.company.customPeppolEndpointId.getShortLabel() }}
                        </p>
                        <p v-if="invoice.customer?.email" class="style-description-small">
                            <EmailAddress :email="invoice.customer.email" />
                        </p>
                        <p v-if="invoice.customer?.phone" v-copyable class="style-description-small style-copyable">
                            {{ invoice.customer.phone }}
                        </p>
                        <p v-if="invoice.customer?.company?.address" v-copyable class="style-description-small style-copyable">
                            {{ invoice.customer?.company?.address }}
                        </p>
                    </dd>
                </template>
            </dl>

            <InvoiceItemsBox :invoice="invoice" />

            <hr>
            <h2>{{ $t('%1JH') }}</h2>

            <p v-if="invoice.payments.length === 0" class="info-box">
                {{ $t('%1TW') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of invoice.payments" :key="payment.id" :payment="payment" :payments="invoice.payments" :price="payment.isFailed ? 0 : payment.price" />
            </STList>

            <template v-if="hasSettlementsFlag && invoiceSettlements.length > 0">
                <hr>
                <h2>{{ $t('%Zj6') }}</h2>
                <p class="style-description">
                    {{ $t('%Zjv') }}
                </p>

                <STList>
                    <STListItem v-for="row of invoiceSettlements" :key="row.settlement.id">
                        <h3 class="style-title-list">
                            {{ row.settlement.reference || row.settlement.externalId }}
                        </h3>
                        <p class="style-description-small">
                            {{ formatDate(row.settlement.settledAt) }}
                        </p>
                        <template #right>
                            {{ formatPrice(row.amount) }}
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useBackForward } from '#hooks/useBackForward.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Invoice } from '@stamhoofd/structures';
import { InvoiceTypeHelper } from '@stamhoofd/structures';

import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import InvoiceItemsBox from './InvoiceItemsBox.vue';
import PaymentRow from '#payments/components/PaymentRow.vue';
import { useDownloadInvoice } from './hooks/useDownloadInvoice.ts';
import { useContext } from '#hooks/useContext.ts';
import { useFeatureFlagComputed } from '#hooks/useFeatureFlag.ts';
import type { Settlement } from '@stamhoofd/structures/settlements/Settlement.js';
import { ArrayDecoder, deepSetArray, PatchableArray } from '@simonbackx/simple-encoding';
import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import LoadingButton from '#navigation/LoadingButton.vue';
import { Toast } from '#overlays/Toast.ts';
import EmailAddress from '#email/EmailAddress.vue';

const props = withDefaults(
    defineProps<{
        invoice: Invoice;
        getNext?: ((invoice: Invoice) => Invoice | null) | null;
        getPrevious?: ((invoice: Invoice) => Invoice | null) | null;
    }>(), {
        getNext: null,
        getPrevious: null,
    },
);

const { hasNext, hasPrevious, goBack, goForward } = useBackForward('invoice', props);
const hasSettlementsFlag = useFeatureFlagComputed('settlements');

// How much of this invoice's payments each payout contained
const invoiceSettlements = computed(() => {
    const grouped = new Map<string, { settlement: Settlement; amount: number }>();
    for (const payment of props.invoice.payments) {
        for (const line of payment.settlements) {
            const existing = grouped.get(line.settlement.id);
            if (existing) {
                existing.amount += line.amount;
            } else {
                grouped.set(line.settlement.id, { settlement: line.settlement, amount: line.amount });
            }
        }
    }
    return [...grouped.values()].sort((a, b) => Sorter.byDateValue(b.settlement.settledAt, a.settlement.settledAt));
});
const errors = useErrors();
const title = props.invoice.number ?? '/';
const { downloadInvoice, downloadInvoicePdf } = useDownloadInvoice();

const isRetrying = ref(false);
const context = useContext();

async function retrySending() {
    if (isRetrying.value) {
        return;
    }
    isRetrying.value = true;

    try {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Invoice>;
        arr.addPatch(Invoice.patch({
            id: props.invoice.id,
            pdf: null,
        }));
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/invoices',
            body: arr,
            decoder: new ArrayDecoder(Invoice as Decoder<Invoice>),
        });
        deepSetArray([props.invoice], response.data);
        Toast.success($t('%Zhq')).show();
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        isRetrying.value = false;
    }
}

</script>
