<template>
    <STGrid>
        <STGridItem v-for="item of invoice.items" :key="item.id" class="price-grid">
            <template #left>
                <IconContainer icon="box" />
            </template>

            <h3 class="style-title-list">
                {{ item.name }}
            </h3>

            <p v-if="item.description" class="style-description-small pre-wrap" v-text="item.description" />

            <p class="style-description-small">
                {{ $t('%1J3', {price: formatPrice(item.unitPrice)}) }}
            </p>

            <p v-if="STAMHOOFD.environment === 'development' && item.addedToUnitPriceToCorrectVAT !== 0" class="style-description-small">
                <span class="style-discount-old-price">{{ $t('%1J3', {price: formatPrice(item.unitPrice - item.addedToUnitPriceToCorrectVAT)}) }}</span>
                <span> ({{ formatPriceChange(item.addedToUnitPriceToCorrectVAT) }})</span>
            </p>

            <p v-if="invoice.VATTotal.length > 1" class="style-description-small">
                {{ $t('%1KT', {'percentage%': formatPercentage(item.VATPercentage * 100)}) }}
            </p>

            <template #middleRight>
                <p class="style-price-base" :class="{negative: item.quantity < 0}">
                    {{ formatFloat(item.quantity / 1_00_00) }}
                </p>
            </template>

            <template #right>
                <p class="style-price-base" :class="{negative: item.totalWithoutVAT < 0}">
                    {{ formatPrice(item.totalWithoutVAT) }}
                </p>
            </template>
        </STGridItem>
    </STGrid>

    <PriceBreakdownBox :price-breakdown="invoice.getPriceBreakdown({vatAction: {icon: 'info-circle', handler: showVATDetails}})" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import STGridItem from '@stamhoofd/components/layout/STGridItem.vue';
import { usePositionableSheet } from '@stamhoofd/components/tables/usePositionableSheet.ts';
import type { Invoice } from '@stamhoofd/structures';
import { default as InvoiceVATDetailsBox } from './InvoiceVATDetailsBox.vue';

const props = withDefaults(
    defineProps<{
        invoice: Invoice;
    }>(), {
    },
);

const { presentPositionableSheet } = usePositionableSheet();

async function showVATDetails(event: MouseEvent) {
    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(InvoiceVATDetailsBox, {
                    invoice: props.invoice,
                }),
            }),
        ],
    }, { minimumHeight: 185 });
}

</script>
