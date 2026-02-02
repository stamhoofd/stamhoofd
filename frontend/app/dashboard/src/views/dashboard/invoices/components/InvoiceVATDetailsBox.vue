<template>
    <div class="st-view">
        <STNavigationBar v-if="!popup" :title="$t('bf9ff30d-258f-4ba3-8dd7-c27595e32da2')" />

        <main>
            <STGrid>
                <STGridItem class="header price-grid">
                    {{ $t('4669ddfd-b0f2-46c2-88dc-beb49dd43262') }}

                    <template #middleRight>
                        {{ $t('9f822d74-c9fe-480b-b141-4d758d188720') }}
                    </template>

                    <template #right>
                        {{ $t('bf9ff30d-258f-4ba3-8dd7-c27595e32da2') }}
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
