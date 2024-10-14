<template>
    <STList>
        <STListItem v-for="item in item.balanceItems" :key="item.id">
            <template #left>
                <span v-if="item.amount === 0" class="style-amount min-width">
                    <span class="icon disabled gray" />
                </span>
                <span v-else class="style-amount min-width">{{ formatFloat(item.amount) }}</span>
            </template>

            <p v-if="item.itemPrefix" class="style-title-prefix-list">
                {{ item.itemPrefix }}
            </p>

            <h3 class="style-title-list">
                {{ item.itemTitle }}
            </h3>

            <p v-if="item.itemDescription" class="style-description-small">
                {{ item.itemDescription }}
            </p>

            <p class="style-description-small">
                {{ formatDate(item.createdAt) }}
            </p>

            <p v-if="item.amount === 0" class="style-description-small">
                Deze schuld werd verwijderd maar werd al (deels) betaald
            </p>

            <p v-else class="style-description-small">
                {{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }} te betalen
            </p>

            <p v-if="item.pricePaid !== 0" class="style-description-small">
                {{ formatPrice(item.pricePaid) }} betaald
            </p>

            <p v-if="item.pricePending !== 0" class="style-description-small">
                {{ formatPrice(item.pricePending) }} in verwerking
            </p>

            <template #right>
                <p class="style-price-base">
                    {{ formatPrice(item.priceOpen) }}
                </p>
            </template>
        </STListItem>
    </STList>
</template>

<script lang="ts" setup>
import { DetailedReceivableBalance } from '@stamhoofd/structures';

defineProps<{
    item: DetailedReceivableBalance;
}>();

</script>
