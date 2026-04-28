<template>
    <div class="payconiq-banner-view">
        <button class="payconiq-close button icon close white" type="button" @click="close" />
        <h1>{{ $t('%1P0') }}</h1>

        <div class="qr-code" :class="{ scanned: payment.status === 'Pending'}">
            <img v-if="payment.status === 'Pending' || payment.status === 'Created'" :src="qrCodeSrc" draggable="false">
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

<script lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import type { Server } from '@simonbackx/simple-networking';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { Payment, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import EmailInput from '../inputs/EmailInput.vue';
import LoadingButton from '../navigation/LoadingButton.vue';
import STFloatingFooter from '../navigation/STFloatingFooter.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        EmailInput,
        LoadingButton,
        STErrorsDefault,
    },
    filters: {
        price: Formatter.price.bind(Formatter),
    },
})
export default class PayconiqBannerView extends Mixins(NavigationMixin) {
    @Prop({})
    paymentUrl: string;

    @Prop({ required: true })
    initialPayment!: Payment;

    payment: Payment = this.initialPayment;

    @Prop({ required: true })
    server: Server;

    @Prop({ required: true })
    finishedHandler: (payment: Payment | null) => void;

    pollCount = 0;
    timer: NodeJS.Timeout | null = null;

    loading = false;
    canceling = false;

    mounted() {
        this.timer = setTimeout(this.poll.bind(this), 3000);
    }

    async close() {
        // Try to cancel the payment in the background
        await this.dismiss();
    }

    cancel() {
        if (this.canceling) {
            return;
        }
        this.canceling = true;
        const paymentId = this.payment.id;
        this.server
            .request({
                method: 'POST',
                path: '/payments/' + paymentId,
                query: {
                    cancel: true,
                },
                decoder: Payment as Decoder<Payment>,
            }).catch(console.error);
    }

    async shouldNavigateAway() {
        if (await CenteredMessage.confirm($t(`%12e`), $t(`%12f`))) {
            this.cancel();
            return true;
        }
        return false;
    }

    get price() {
        return this.payment?.price ?? 0;
    }

    poll() {
        this.timer = null;
        const paymentId = this.payment.id;
        this.server
            .request({
                method: 'POST',
                path: '/payments/' + paymentId,
                decoder: Payment as Decoder<Payment>,
            }).then((response) => {
                const payment = response.data;
                this.payment = payment;

                if (payment.status === PaymentStatus.Succeeded) {
                    this.finishedHandler(payment);
                    this.dismiss({ force: true }).catch(console.error);
                }

                if (payment.status === PaymentStatus.Failed) {
                    // TODO: temporary message
                    this.finishedHandler(payment);
                    this.dismiss({ force: true }).catch(console.error);
                }
            }).catch((e) => {
                // too: handle this
                console.error(e);
            }).finally(() => {
                this.pollCount++;
                if (this.payment.status === PaymentStatus.Succeeded || this.payment.status === PaymentStatus.Failed) {
                    return;
                }
                this.timer = setTimeout(this.poll.bind(this), 3000);
            });
    }

    beforeUnmount() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.payment.status !== PaymentStatus.Succeeded && this.payment.status !== PaymentStatus.Failed) {
            this.finishedHandler(this.payment);
        }
    }

    get qrCodeSrc() {
        return this.paymentUrl;
    }
}
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
