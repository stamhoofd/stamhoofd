<template>
    <div class="payconiq-banner-view">
        <button class="payconiq-close button icon close white" type="button" @click="close" />
        <h1>{{ $t('%1P0') }}</h1>

        <div class="qr-code" :class="{ scanned: payment.status === 'Pending'}" data-testid="payconiq-qr">
            <img v-if="payment.status === 'Pending' || payment.status === 'Created'" height="64" width="64" :src="qrCodeSrc" draggable="false">
        </div>
        <img height="64" src="@stamhoofd/assets/images/partners/icons/bancontact-pay.png">

        <LoadingButton :loading="payment && payment.status === 'Pending'" class="price-loading">
            <p class="price">
                {{ formatPrice(price) }}
            </p>
        </LoadingButton>

        <p>{{ $t('%kF') }}</p>
    </div>
</template>

<script lang="ts" setup>
import type { Server } from '@simonbackx/simple-networking';
import type { Payment } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import LoadingButton from '../navigation/LoadingButton.vue';
import { usePayconiqPayment } from './usePayconiqPayment';

const props = withDefaults(defineProps<{
    paymentUrl?: string;
    initialPayment: Payment;
    server: Server;
    finishedHandler: (payment: Payment | null) => void;
}>(), {
    paymentUrl: '',
});

const formatPrice = Formatter.price.bind(Formatter);
const { close, payment, price, qrCodeSrc, shouldNavigateAway } = usePayconiqPayment(props);

defineExpose({ shouldNavigateAway });
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

    .payconiq-banner-view {
        padding: 40px 30px;
        background: $color-background;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        --st-sheet-width: 380px;

        p {
            font-size: 16px;
            font-weight: 500;
        }

        .payconiq-close {
            color: $color-dark;
            position: absolute !important;
            top: 15px;
            right: 15px;
        }

        > h1 {
            font-size: 25px;
            font-weight: bold;
            line-height: 1.5;
            padding-bottom: 10px;
        }

        .price {
            font-size: 25px;
            font-weight: bold;
            margin: 20px 0;
        }

        .qr-code {
            overflow: hidden;
            width: 250px;
            height: 250px;
            background: white;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;

            img {
                width: 240px;
                height: 240px;
                transition: opacity 0.2s;
            }
            margin-bottom: 20px;

            &.scanned {
                img {
                    opacity: 0.5;
                }
            }
        }

        .install {
            margin-bottom: 15px;;
        }
    }
</style>
