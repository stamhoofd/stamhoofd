<template>
    <div class="pricing-box">
        <template v-for="(item, index) of priceBreakdown" :key="index">
            <div class="left">
                {{ item.name }}
            </div>

            <div class="right">
                {{ formatPrice(item.price) }}
            </div>
        </template>
    </div>
</template>


<script lang="ts" setup>
import { PriceBreakdown } from '@stamhoofd/structures';

defineProps<{
    priceBreakdown: PriceBreakdown
}>();
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.pricing-box {
    margin-top: auto;
    display: grid;
    grid-template-columns: 1fr auto;
    padding: 15px 0;

    .left {
        text-align: right;
        padding: 12px 0;
        padding-right: 20px;
        font-size: 15px;
        font-weight: $font-weight-semibold;

        &:nth-last-child(2) {
            font-size: 18px;
            font-weight: $font-weight-bold;
        }
    }

    .right {
        min-width: 100px;
        padding: 12px 0;
        text-align: right;
        font-size: 15px;
        font-weight: $font-weight-medium;
        font-variant-numeric: tabular-nums;

        &:last-child {
            font-size: 18px;
            font-weight: $font-weight-bold;
        }
    }
}
</style>
