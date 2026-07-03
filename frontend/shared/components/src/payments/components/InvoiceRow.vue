<template>
    <STListItem :selectable="true" :class="'right-stack ' + (invoice.theme ?? '')" @click="navigate(Route)">
        <template #left>
            <IconContainer icon="receipt" class="gray" />
        </template>

        <p class="style-title-prefix-list">
            <span>{{ InvoiceTypeHelper.getName(invoice.type) }}</span>
        </p>

        <h3 class="style-title-list">
            {{ invoice.number ?? invoice.id }}
        </h3>

        <p v-if="invoice.invoicedAt" class="style-description-small">
            {{ formatDate(invoice.invoicedAt) }}
        </p>

        <p v-if="description" class="style-description-small pre-wrap" v-text="description" />

        <template #right>
            <span class="style-price-base" :class="{negative: invoice.totalWithVAT < 0}">{{ formatPrice(invoice.totalWithVAT) }}</span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { defineRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import type { Invoice } from '@stamhoofd/structures';
import { InvoiceTypeHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import IconContainer from '../../icons/IconContainer.vue';

const props = withDefaults(
    defineProps<{
        invoice: Invoice;
        invoices?: Invoice[];
    }>(), {
        invoices: () => [],
    },
);

const navigate = useNavigate();

const description = computed(() => {
    if (props.invoice.items.length > 2) {
        return $t('%1Zv', { count: props.invoice.items.length });
    }
    return Formatter.uniqueArray(props.invoice.items.map(i => i.name)).join('\n');
});

const Route = defineRoute({
    url: props.invoice.id,
    show: true,
    component: async () => (await import('../InvoiceView.vue')).default,
    defaultProperties() {
        return {
            invoice: props.invoice,
            getNext: (invoice: Invoice) => {
                const index = props.invoices.findIndex(i => i.id === invoice.id);
                if (index === -1 || index === props.invoices.length - 1) {
                    return null;
                }
                return props.invoices[index + 1];
            },
            getPrevious: (invoice: Invoice) => {
                const index = props.invoices.findIndex(i => i.id === invoice.id);
                if (index === -1 || index === 0) {
                    return null;
                }
                return props.invoices[index - 1];
            },
        };
    },
});
</script>
