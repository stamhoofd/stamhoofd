<template>
    <div class="st-view">
        <STNavigationBar v-if="!popup" :title="$t('BTW')" />

        <main>
            <STGrid>
                <STGridItem class="header price-grid">
                    {{ $t('BTW %') }}

                    <template #middleRight>
                        {{ $t('Excl. BTW') }}
                    </template>

                    <template #right>
                        {{ $t('BTW') }}
                    </template>
                </STGridItem>

                <STGridItem v-for="(subtotal, index) of invoice.VATTotal" :key="index" class="price-grid">
                    <h3 v-if="!subtotal.VATExcempt" class="style-title-list">
                        {{ formatPercentage(subtotal.VATPercentage * 100) }}
                    </h3>
                    <h3 v-else class="style-title-list">
                        {{ getVATExcemptInvoiceNote(subtotal.VATExcempt) }} ({{ formatPercentage(subtotal.VATPercentage * 100) }})
                    </h3>

                    <template #middleRight>
                        <p class="style-price-base" :class="{negative: subtotal.taxablePrice < 0}">
                            {{ formatPrice(subtotal.taxablePrice) }}
                        </p>
                    </template>

                    <template #right>
                        <p class="style-price-base" :class="{negative: subtotal.VAT < 0}">
                            {{ formatPrice(subtotal.VAT) }}
                        </p>
                    </template>
                </STGridItem>
            </STGrid>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { usePopup } from '@simonbackx/vue-app-navigation';
import { STGrid, STGridItem } from '@stamhoofd/components';
import { getVATExcemptInvoiceNote, Invoice } from '@stamhoofd/structures';

withDefaults(
    defineProps<{
        invoice: Invoice;
    }>(), {
    },
);

const popup = usePopup();

</script>
