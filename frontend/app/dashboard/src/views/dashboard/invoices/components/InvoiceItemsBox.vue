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
                {{ $t('22ba722b-947f-42f0-9679-4e965f5b7200', {price: formatPrice(item.unitPrice)}) }}
            </p>

            <p v-if="item.addedToUnitPriceToCorrectVAT !== 0" class="style-description-small">
                <span class="style-discount-old-price">{{ $t('22ba722b-947f-42f0-9679-4e965f5b7200', {price: formatPrice(item.unitPrice - item.addedToUnitPriceToCorrectVAT)}) }}</span>
            </p>

            <p v-if="invoice.VATTotal.length > 1" class="style-description-small">
                {{ $t('{percentage%} BTW', {'percentage%': formatPercentage(item.VATPercentage * 100)}) }}
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

                <p class="style-price-base" :class="{negative: item.preciseTotalWithoutVAT < 0}">
                    {{ formatPrice(item.preciseTotalWithoutVAT) }}
                </p>
            </template>
        </STGridItem>
    </STGrid>

    <PriceBreakdownBox :price-breakdown="invoice.getPriceBreakdown({vatAction: {icon: 'info-circle', handler: showVATDetails}})" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { IconContainer, PriceBreakdownBox, STGrid, STGridItem, usePositionableSheet } from '@stamhoofd/components';
import { Invoice } from '@stamhoofd/structures';
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
