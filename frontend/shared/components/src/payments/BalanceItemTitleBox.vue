<template>
    <template v-if="paymentStatus === null">
        <p v-if="item.dueAt" class="style-title-prefix-list" :class="{error: item.isOverDue}">
            <span>Te betalen tegen {{ formatDate(item.dueAt) }}</span>
            <span v-if="item.isOverDue" class="icon error small" />
        </p>
        <p v-if="item.status === BalanceItemStatus.Canceled && (price === null || price < 0)" class="style-title-prefix-list error">
            <span>Geannuleerd</span>
            <span class="icon disabled small" />
        </p>
        <p v-else-if="item.priceOpen < 0 && item.pricePaid > item.price && item.pricePaid > 0" class="style-title-prefix-list">
            <span>Te veel betaald</span>
            <span class="icon undo small" />
        </p>
        <p v-else-if="item.priceOpen < 0" class="style-title-prefix-list">
            <span v-if="isPayable">Terug te krijgen</span>
            <span v-else>Terug te betalen</span>
            <span class="icon undo small" />
        </p>
    </template>

    <h3 class="style-title-list">
        {{ item.itemTitle }}
    </h3>

    <p v-if="item.itemDescription" class="style-description-small pre-wrap" v-text="item.itemDescription" />

    <template v-if="paymentStatus === null">
        <p v-if="item.price === item.amount * item.unitPrice" class="style-description-small">
            {{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }}
        </p>
        <p v-else class="style-description-small">
            <span class="style-discount-old-price">{{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }}</span><span class="style-discount-price">{{ formatPrice(item.price) }}</span>
        </p>
    </template>

    <template v-if="price === null && paymentStatus === null">
        <p v-if="item.pricePaid !== 0 && item.pricePaid !== (item.amount * item.unitPrice)" class="style-description-small">
            {{ formatPrice(item.pricePaid ) }} betaald
        </p>

        <p v-if="item.pricePending !== 0" class="style-description-small">
            {{ formatPrice(item.pricePending) }} in verwerking
        </p>
    </template>

    <p v-if="item instanceof BalanceItem" class="style-description-small">
        {{ formatDate(item.createdAt) }}
    </p>
</template>

<script lang="ts" setup>
import { BalanceItem, BalanceItemStatus, GroupedBalanceItems, PaymentStatus } from '@stamhoofd/structures';

withDefaults(
    defineProps<{
        item: BalanceItem | GroupedBalanceItems;
        isPayable: boolean;

        // In case it is about a (partial) payment
        price?: number | null;
        paymentStatus?: PaymentStatus | null;
    }>(),
    {
        price: null,
        paymentStatus: null,
    },
);

</script>
