<template>
    <STListItem :selectable="true" class="right-stack" @click="downloadInvoice(invoice)">
        <h3 class="style-title-list">
            {{ invoice.totalWithVAT < 0 ? 'Creditnota' : 'Factuur' }} {{ invoice.number }}
        </h3>
        <p v-if="invoice.invoicedAt" class="style-description">
            {{ formatDate(invoice.invoicedAt, true) }}
        </p>

        <p v-if="description" class="style-description pre-wrap" v-text="description" />

        <template #right>
            <button v-if="invoice.xml && invoice.pdf" v-tooltip="'Download PDF in plaats van XML (niet officieel)'" type="button" class="button icon color-pdf file-pdf" @click.stop="downloadInvoicePdf(invoice)" />
            <span class="icon download gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { Invoice } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useDownloadInvoice } from './hooks/useDownloadInvoice';

const props = defineProps<{
    invoice: Invoice;
}>();

const description = computed(() => {
    if (props.invoice.items.length > 2) {
        return $t('%1Zv', { count: props.invoice.items.length });
    }
    return Formatter.uniqueArray(props.invoice.items.map(i => i.name)).join('\n');
});

const { downloadInvoice, downloadInvoicePdf } = useDownloadInvoice();

</script>
