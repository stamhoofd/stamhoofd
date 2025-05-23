<template>
    <template v-if="paymentStatus === null">
        <p v-if="item.dueAt && item.price >= 0" class="style-title-prefix-list" :class="{error: item.isOverDue}">
            <span>{{ $t('04392571-f6a2-470d-b2a1-90004ac27dbc', {date: formatDate(item.dueAt)}) }}</span>
            <span v-if="item.isOverDue" class="icon error small" />
        </p>
        <p v-if="item.status === BalanceItemStatus.Canceled && (price === null || price < 0)" class="style-title-prefix-list error">
            <span>{{ $t('72fece9f-e932-4463-9c2b-6e8b22a98f15') }}</span>
            <span class="icon disabled small" />
        </p>
        <p v-else-if="item.priceOpen < 0 && item.pricePaid > item.price && item.pricePaid > 0" class="style-title-prefix-list">
            <span>{{ $t('0c39a71f-be73-4404-8af0-cd9f238d2060') }}</span>
            <span class="icon undo small" />
        </p>
        <p v-else-if="item.price >= 0 && item.priceOpen < 0" class="style-title-prefix-list">
            <span v-if="isPayable">{{ $t('bdf22906-037e-4221-8d3e-113bc62da28e') }}</span>
            <span v-else>{{ $t('c59769e0-b0fa-42f3-b713-82a2d7237a9c') }}</span>
            <span class="icon undo small" />
        </p>
    </template>

    <h3 class="style-title-list">
        {{ item.itemTitle }}
    </h3>

    <p v-if="item.itemDescription" class="style-description-small pre-wrap" v-text="item.itemDescription" />

    <template v-if="showPrices">
        <template v-if="paymentStatus === null && item.status !== BalanceItemStatus.Canceled">
            <p v-if="item.price === item.amount * item.unitPrice" class="style-description-small">
                {{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }}
            </p>
            <p v-else class="style-description-small">
                <span class="style-discount-old-price">{{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }}</span><span class="style-discount-price">{{ formatPrice(item.price) }}</span>
            </p>
        </template>

        <template v-if="price === null && paymentStatus === null">
            <p v-if="item.pricePaid !== 0 && item.pricePaid !== (item.amount * item.unitPrice)" class="style-description-small">
                {{ $t('72cf6e0c-87b5-47ae-af91-4112e24c13e1', {price: formatPrice(item.pricePaid )}) }}
            </p>

            <p v-if="item.pricePending !== 0" class="style-description-small">
                {{ $t('b9a73b33-2a3d-44fa-a326-66cb8b8e1184', {price: formatPrice(item.pricePending)}) }}
            </p>
        </template>

        <p v-if="item instanceof BalanceItem" class="style-description-small">
            {{ formatDate(item.createdAt) }}
        </p>
    </template>
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
        showPrices?: boolean;
    }>(),
    {
        price: null,
        paymentStatus: null,
        showPrices: true,
    },
);

</script>
