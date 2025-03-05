<template>
    <template v-if="paymentStatus === null">
        <p v-if="item.dueAt" class="style-title-prefix-list" :class="{error: item.isOverDue}">
            <span>{{ $t('76afd2bd-cb26-41fe-a995-6d2112a02d12') }} {{ formatDate(item.dueAt) }}</span>
            <span v-if="item.isOverDue" class="icon error small"/>
        </p>
        <p v-if="item.status === BalanceItemStatus.Canceled && (price === null || price < 0)" class="style-title-prefix-list error">
            <span>{{ $t('c3185c88-a04f-4aa8-a93f-af3a816964f1') }}</span>
            <span class="icon disabled small"/>
        </p>
        <p v-else-if="item.priceOpen < 0 && item.pricePaid > item.price && item.pricePaid > 0" class="style-title-prefix-list">
            <span>{{ $t('ba1de071-39e4-4444-a433-9678084b10ef') }}</span>
            <span class="icon undo small"/>
        </p>
        <p v-else-if="item.priceOpen < 0" class="style-title-prefix-list">
            <span v-if="isPayable">{{ $t('aecaad0f-d11f-4f48-ab85-babaf9208fe0') }}</span>
            <span v-else>{{ $t('1375722b-c818-43c9-a1f1-a011b508556c') }}</span>
            <span class="icon undo small"/>
        </p>
    </template>

    <h3 class="style-title-list">
        {{ item.itemTitle }}
    </h3>

    <p v-if="item.itemDescription" class="style-description-small pre-wrap" v-text="item.itemDescription"/>

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
            {{ formatPrice(item.pricePaid ) }} {{ $t('abc7b555-cfe2-4165-bb9d-3aed3ef481cd') }}
        </p>

        <p v-if="item.pricePending !== 0" class="style-description-small">
            {{ formatPrice(item.pricePending) }} {{ $t('d2728495-de3c-4730-b4d3-4d11223ea2bc') }}
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
