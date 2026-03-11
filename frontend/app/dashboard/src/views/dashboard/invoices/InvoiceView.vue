<template>
    <div class="st-view invoice-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="$t('03b92fed-e144-4ace-a931-dc8421734bcd')" type="button" class="button icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="$t('187657c7-d1ad-4047-a693-ab0e215d41fc')" type="button" class="button icon arrow-down" :disabled="!hasNext" @click="goForward" />
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
                        {{ $t('a3c698a7-834d-41ea-a184-22341e4cc129') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(invoice.invoicedAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('c6a1f96a-0e71-44c1-89a2-20bfd206d9c6', {time: formatTime(invoice.invoicedAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.dueAt">
                    <h3 class="style-definition-label">
                        {{ $t('92c75f77-9120-424a-83f5-39e26623c1ad') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(invoice.dueAt) }}
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('b1ac8856-0f2d-4238-a0f7-1868eebc1df1') }}</h2>

            <STList v-if="invoice.customer.company" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('67928a02-b3f1-465a-9dd7-569d061599a9') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.name }}
                    </p>
                    <p v-if="!invoice.customer.company.VATNumber && !invoice.customer.company.companyNumber" class="style-description">
                        {{ $t('1c5b447a-93e8-46da-b6e1-ffc29a2967e8') }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.company.VATNumber">
                    <h3 class="style-definition-label">
                        {{ $t('263b7054-d38f-4bb9-be63-84b4e614613d') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.VATNumber }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.company.companyNumber && (!invoice.customer.company.VATNumber || (invoice.customer.company.companyNumber !== invoice.customer.company.VATNumber && invoice.customer.company.companyNumber !== invoice.customer.company.VATNumber.slice(2)))">
                    <h3 class="style-definition-label">
                        {{ $t('12f64ea7-fb54-4178-8267-9de12bdf70d7') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.companyNumber }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.company.address">
                    <h3 class="style-definition-label">
                        {{ $t('0a37de09-120b-4bea-8d13-6d7ed6823884') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.address.toString() }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.company.administrationEmail">
                    <h3 class="style-definition-label">
                        {{ $t('237d0720-13f0-4029-8bf2-4de7e0a9a358') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.company.administrationEmail }}
                    </p>
                </STListItem>

                <STListItem v-if="invoice.customer.name">
                    <h3 class="style-definition-label">
                        {{ $t('2a10aac1-e404-4de4-865d-75593b2b5e8d') }}
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
                        {{ $t('1474bb78-8f01-456a-9e85-c6b1748b76d5') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ invoice.customer.name || $t('0076d594-efee-4ec7-a00a-073a4c689a38') }}
                    </p>
                    <p v-if="invoice.customer.email" v-copyable class="style-description style-copyable">
                        {{ invoice.customer.email }}
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('4385bcc8-1643-4352-b766-a658e4c33f80') }}</h2>

            <STList>
                <STListItem v-for="item in sortedItems" :key="item.id">
                    <h3 class="style-title-list pre-wrap" v-text="item.name" />
                    <p v-if="item.description" class="style-description-small pre-wrap" v-text="item.description" />

                    <template #right>
                        <span class="style-price-base" :class="{negative: item.unitPrice < 0}">{{ item.unitPrice === 0 ? 'Gratis' : formatPrice(item.unitPrice) }}</span>
                    </template>
                </STListItem>
            </STList>

            <PriceBreakdownBox :price-breakdown="invoice.priceBreakdown" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { PriceBreakdownBox, STErrorsDefault, STList, STListItem, STNavigationBar, useBackForward, useErrors } from '@stamhoofd/components';
import { Invoice, InvoiceTypeHelper } from '@stamhoofd/structures';

import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';

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

const sortedItems = computed(() => {
    return props.invoice.items.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byNumberValue(a.totalWithoutVAT, b.totalWithoutVAT),
            Sorter.byStringValue(a.name, b.name),
        );
    });
});
</script>
