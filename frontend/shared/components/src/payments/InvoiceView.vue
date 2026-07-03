<template>
    <div class="st-view invoice-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="invoice.xml && invoice.pdf" v-tooltip="'Download PDF in plaats van XML (niet officieel)'" type="button" class="button icon color-pdf file-pdf" @click="downloadInvoicePdf(invoice)" />
                <button type="button" class="button icon download gray" @click="downloadInvoice(invoice)" />

                <button v-if="hasPrevious || hasNext" v-tooltip="$t('%hA')" type="button" class="button icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="$t('%hB')" type="button" class="button icon arrow-down" :disabled="!hasNext" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <p :class="'style-title-prefix ' + invoice.theme">
                <span>{{ capitalizeFirstLetter(InvoiceTypeHelper.getName(invoice.type)) }}</span>
            </p>

            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ title }}</span>
            </h1>
            <STErrorsDefault :error-box="errors.errorBox" />

            <STList class="info">
                <STListItem v-if="invoice.invoicedAt">
                    <h3 class="style-definition-label">
                        {{ $t('%1J6') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(invoice.invoicedAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%hI', {time: formatTime(invoice.invoicedAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.dueAt">
                    <h3 class="style-definition-label">
                        {{ $t('%1J7') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(invoice.dueAt) }}
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('%1J1') }}</h2>

            <STList v-if="invoice.customer.company" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1JI') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.name }}
                    </p>
                    <p v-if="!invoice.customer.company.VATNumber && !invoice.customer.company.companyNumber" class="style-description">
                        {{ $t('%1CH') }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.company.VATNumber">
                    <h3 class="style-definition-label">
                        {{ $t('%1CK') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.VATNumber }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.company.companyNumber && (!invoice.customer.company.VATNumber || (invoice.customer.company.companyNumber !== invoice.customer.company.VATNumber && invoice.customer.company.companyNumber !== invoice.customer.company.VATNumber.slice(2)))">
                    <h3 class="style-definition-label">
                        {{ $t('%wa') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.companyNumber }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.company.address">
                    <h3 class="style-definition-label">
                        {{ $t('%Cn') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.address.toString() }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.company.administrationEmail">
                    <h3 class="style-definition-label">
                        {{ $t('%1FK') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.administrationEmail }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.name">
                    <h3 class="style-definition-label">
                        {{ $t('%1Kl') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.name }}
                    </p>
                    <p v-if="invoice.customer.email" v-copyable class="style-description style-copyable">
                        {{ invoice.customer.email }}
                    </p>
                </STListItem>
            </STList>

            <STList v-else class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1J8') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.name || $t('%CL') }}
                    </p>
                    <p v-if="invoice.customer.email" v-copyable class="style-description style-copyable">
                        {{ invoice.customer.email }}
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('%YI') }}</h2>

            <InvoiceItemsBox :invoice="invoice" />

            <hr>
            <h2>{{ $t('%1JH') }}</h2>

            <p v-if="invoice.payments.length === 0" class="info-box">
                {{ $t('%1TW') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of invoice.payments" :key="payment.id" :payment="payment" :payments="invoice.payments" :price="payment.isFailed ? 0 : payment.price" />
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useBackForward } from '@stamhoofd/components/hooks/useBackForward.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import type { Invoice } from '@stamhoofd/structures';
import { InvoiceTypeHelper } from '@stamhoofd/structures';

import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import InvoiceItemsBox from './InvoiceItemsBox.vue';
import PaymentRow from '@stamhoofd/components/payments/components/PaymentRow.vue';
import { useDownloadInvoice } from './hooks/useDownloadInvoice.ts';

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
const errors = useErrors();
const title = props.invoice.number ?? '/';
const { downloadInvoice, downloadInvoicePdf } = useDownloadInvoice();

</script>
