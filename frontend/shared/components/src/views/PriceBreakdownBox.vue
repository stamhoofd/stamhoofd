<template>
    <div class="pricing-box">
        <template v-for="(item, index) of priceBreakdown" :key="index">
            <div class="left">
                <h3>
                    <span>{{ item.name }}</span>
                    <button v-if="item.action" :class="'button icon small ' + item.action.icon" type="button" @click="item.action.handler" />
                </h3>
                <p v-if="item.description">
                    {{ item.description }}
                </p>
            </div>

            <div class="right" :class="{negative: item.price < 0}">
                {{ formatPrice(item.price) }}
            </div>
        </template>
    </div>
</template>

<script lang="ts" setup>
import { PriceBreakdown } from '@stamhoofd/structures';

defineProps<{
    priceBreakdown: PriceBreakdown;
}>();
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.pricing-box {
    margin-top: auto;
    display: grid;
    grid-template-columns: 1fr auto;
    padding: 15px 0;

    .left {
        text-align: right;
        padding: 12px 0;
        padding-right: 20px;

        > h3 {
            font-size: 15px;
            font-weight: $font-weight-semibold;
            display: flex;
            flex-direction: row;
            gap: 5px;
            align-items: center;
            justify-content: flex-end;
        }

        > p {
            @extend .style-description-small;
            padding-top: 3px;
        }

        &:nth-last-child(2) {
            > h3 {
                font-size: 18px;
                font-weight: $font-weight-bold;
            }

            > p {
                padding-top: 5px;
            }
        }
    }

    .right {
        min-width: 100px;
        padding: 12px 0;
        text-align: right;

        @extend .style-price-base;

        &:last-child {
            font-size: 18px;
            font-weight: $font-weight-bold;
        }
    }
}
</style>
