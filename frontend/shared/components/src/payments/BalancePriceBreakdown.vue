<template>
    <PriceBreakdownBox :price-breakdown="priceBreakdown" />
</template>

<script setup lang="ts">
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { DetailedReceivableBalance, PriceBreakdown } from '@stamhoofd/structures';
import { BalanceItem, DetailedPayableBalance, getVATExcemptInvoiceNote } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { usePositionableSheet } from '#tables/usePositionableSheet.ts';

const props = defineProps<{
    item: DetailedPayableBalance | DetailedReceivableBalance;
}>();

const isPayable = props.item instanceof DetailedPayableBalance;

/**
 * Only payable balances with items that have an exclusive VAT rate show VAT rows: those items are
 * listed excluding VAT, so the breakdown adds the VAT back with the same rows as on an invoice.
 */
const vatBreakdown = computed(() => props.item instanceof DetailedPayableBalance && props.item.hasExclusiveVAT ? props.item.VATBreakdown : []);
const totalVAT = computed(() => vatBreakdown.value.reduce((sum, subtotal) => sum + subtotal.VAT, 0));

const priceBreakdown = computed((): PriceBreakdown => {
    const now = BalanceItem.getDueOffset();
    const laterBalance = BalanceItem.getOutstandingBalance(props.item.filteredBalanceItems.filter(i => i.dueAt !== null && i.dueAt > now));
    const balance = BalanceItem.getOutstandingBalance(props.item.filteredBalanceItems.filter(i => i.dueAt === null || i.dueAt <= now));

    const discountBalance = isPayable ? BalanceItem.getOutstandingBalance(props.item.discountBalanceItems) : BalanceItem.getOutstandingBalance([]);

    if (balance.priceOpen < 0) {
        if (laterBalance.priceOpen > 0) {
            // Let it fill in the gap
            const max = -balance.priceOpen;
            balance.priceOpen = Math.min(0, balance.priceOpen + laterBalance.priceOpen);
            laterBalance.priceOpen -= Math.min(max, laterBalance.priceOpen);
        }
    }

    const paid = balance.pricePaid + laterBalance.pricePaid - discountBalance.pricePaid;

    const all: PriceBreakdown = [
        {
            name: $t(`%1Xl`),
            price: discountBalance.priceOpen, // only relevant shown
            action: {
                icon: 'info-circle',
                handler: showDiscountSheet,
            },
        },
        {
            name: paid >= 0 ? $t(`%ly`) : $t('%1Yy'),
            price: paid, // don't include discounts here
        },
        {
            name: $t(`%1OL`),
            price: balance.pricePending + laterBalance.pricePending - discountBalance.pricePending, // don't include discounts here
        },
    ].filter(a => a.price !== 0);

    const totalWithVAT = balance.payablePriceWithVAT + laterBalance.payablePriceWithVAT - discountBalance.payablePriceWithVAT;

    if (all.length > 0) {
        all.unshift({
            name: vatBreakdown.value.length > 0 ? $t(`%1KL`) : $t(`%lz`),
            price: totalWithVAT,
        });
    }

    // The items are listed excluding VAT: start with the total excluding VAT and the VAT that is
    // added to it (like on an invoice), so every row follows from the rows above it
    if (vatBreakdown.value.length > 0) {
        const single = vatBreakdown.value.length === 1 ? vatBreakdown.value[0] : null;

        all.unshift({
            name: $t(`%1KK`),
            price: totalWithVAT - totalVAT.value,
        }, {
            name: $t(`%1JE`) + (single ? ' (' + Formatter.percentage(single.VATPercentage * 100) + ')' : ''),
            description: single?.VATExcempt ? getVATExcemptInvoiceNote(single.VATExcempt) : undefined,
            price: totalVAT.value,
            action: single ? undefined : { icon: 'info-circle', handler: showVATDetails },
        });
    }

    if (laterBalance.priceOpen > 0) {
        all.push({
            name: $t(`%10Z`),
            price: laterBalance.priceOpen,
        });
    }

    return [
        ...all,
        {
            name: balance.priceOpen < 0 ? (isPayable ? $t(`%10a`) : $t(`%10b`)) : (laterBalance.priceOpen !== 0 ? $t(`%10c`) : $t(`%m0`)),
            price: Math.abs(balance.priceOpen),
        },
    ];
});

const { presentPositionableSheet } = usePositionableSheet();

async function showVATDetails(event: MouseEvent) {
    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./BalanceVATDetailsBox.vue'), {
                    vatBreakdown: vatBreakdown.value,
                }),
            }),
        ],
    }, { minimumHeight: 185 });
}

async function showDiscountSheet(event: MouseEvent) {
    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./components/DiscountsSheet.vue'), {
                    items: props.item.discountBalanceItems,
                }),
            }),
        ],
    }, { minimumHeight: 185, width: 500 });
}

</script>
