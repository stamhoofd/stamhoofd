<template>
    <template v-if="paymentStatus === null">
        <p v-if="item.status === BalanceItemStatus.Canceled && (price === null || price < 0)" class="style-title-prefix-list error">
            <span>{{ $t('%gg') }}</span>
            <span class="icon disabled small" />
        </p>
        <p v-else-if="item.priceOpen < 0 && item.pricePaid > item.price && item.pricePaid > 0" class="style-title-prefix-list">
            <span>{{ $t('%gh') }}</span>
            <span class="icon undo small" />
        </p>
        <p v-else-if="item.price >= 0 && item.priceOpen < 0" class="style-title-prefix-list">
            <span v-if="isPayable">{{ $t('%10a') }}</span>
            <span v-else>{{ $t('%10b') }}</span>
            <span class="icon undo small" />
        </p>
    </template>

    <h3 class="style-title-list">
        {{ item.itemTitle }}
    </h3>
    <p v-if="paymentStatus === null && item.dueAt && item.price >= 0" class="style-description-small" :class="{error: item.isOverDue}">
        <span>{{ $t('%gf', {date: formatDate(item.dueAt)}) }}</span>
        <span v-if="item.isOverDue" class="icon error gray tiny" />
    </p>
    <p v-if="item.itemDescription" class="style-description-small pre-wrap" v-text="item.itemDescription" />

    <template v-if="showPrices">
        <template v-if="paymentStatus === null && item.status !== BalanceItemStatus.Canceled">
            <p v-if="item.amount !== 1" class="style-description-small">
                {{ $t('%1J3', {price: formatPrice(item.unitPriceWithVAT)}) }}
            </p>
        </template>

        <p v-if="item instanceof BalanceItem" class="style-description-small">
            {{ formatDate(item.createdAt) }}
        </p>
    </template>
</template>

<script lang="ts" setup>
import type { GroupedBalanceItems, PaymentStatus } from '@stamhoofd/structures';
import { BalanceItem, BalanceItemStatus } from '@stamhoofd/structures';

withDefaults(
    defineProps<{
        item: BalanceItem | GroupedBalanceItems;
        isPayable: boolean;

        // In case it is about a (partial) payment
        price?: number | null;
        paymentStatus?: PaymentStatus | null;
        showPrices?: boolean;
    }>(),
    {
        price: null,
        paymentStatus: null,
        showPrices: true,
    },
);

</script>
