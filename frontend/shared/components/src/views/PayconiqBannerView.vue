<template>
    <div class="payconiq-banner-view">
        <button class="payconiq-close button icon close white" type="button" @click="close" />
        <h1>Scan en betaal met Payconiq by Bancontact</h1>

        <div class="payconiq-logo" />

        <div class="qr-code" :class="{ scanned: payment.status == 'Pending'}">
            <img v-if="payment.status == 'Pending' || payment.status == 'Created'" :src="qrCodeSrc">
        </div>

        <LoadingButton :loading="payment && payment.status == 'Pending'" class="price-loading">
            <p class="price">
                {{ formatPrice(price) }}
            </p>
        </LoadingButton>

        <p>Of scan met een ondersteunende bank app</p>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { Server } from '@simonbackx/simple-networking';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, EmailInput, LoadingButton, STErrorsDefault,STFloatingFooter, STNavigationBar } from "@stamhoofd/components"
import { Payment,PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        EmailInput,
        LoadingButton,
        STErrorsDefault
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
})
export default class PayconiqBannerView extends Mixins(NavigationMixin){
    @Prop({})
        paymentUrl: string;

    @Prop({ required: true })
        initialPayment!: Payment

    payment: Payment = this.initialPayment

    @Prop({ required: true })
        server: Server

    @Prop({ required: true })
        finishedHandler: (payment: Payment | null) => void

    pollCount = 0
    timer: any = null

    loading = false
    canceling = false

    mounted() {
        this.timer = setTimeout(this.poll.bind(this), 3000);
    }

    close() {
        // Try to cancel the payment in the background
        this.dismiss();
    }

    cancel() {
        if (this.canceling) {
            return;
        }
        this.canceling = true;
        const paymentId = this.payment.id
        this.server
            .request({
                method: "POST",
                path: "/payments/" +paymentId,
                query: {
                    cancel: true
                },
                decoder: Payment as Decoder<Payment>,
            }).catch(console.error)
    }

    async shouldNavigateAway() {
        if (await CenteredMessage.confirm("Sluit dit alleen als je zeker bent dat je niet hebt betaald! Anders moet je gewoon even wachten.", "Ik heb nog niet betaald")) {
            this.cancel();
            return true;
        }
        return false;
    }

    get price() {
        return this.payment?.price ?? 0
    }

    poll() {
        this.timer = null;
        const paymentId = this.payment.id
        this.server
            .request({
                method: "POST",
                path: "/payments/" +paymentId,
                decoder: Payment as Decoder<Payment>,
            }).then(response => {
                const payment = response.data
                this.payment = payment

                if (payment.status == PaymentStatus.Succeeded) {
                    this.finishedHandler(payment)
                    this.dismiss({ force: true })
                }

                if (payment.status == PaymentStatus.Failed) {
                    // TODO: temporary message
                    this.finishedHandler(payment)
                    this.dismiss({ force: true })
                }
            }).catch(e => {
                // too: handle this
                console.error(e)
            }).finally(() => {
                this.pollCount++;
                if (this.payment.status == PaymentStatus.Succeeded || this.payment.status == PaymentStatus.Failed) {
                    return;
                }
                this.timer = setTimeout(this.poll.bind(this), 3000);
            });
    }

    beforeDestroy() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }

        if (this.payment.status != PaymentStatus.Succeeded && this.payment.status != PaymentStatus.Failed) {
            this.finishedHandler(this.payment)
        }
    }

    get qrCodeSrc() {
        return "https://portal.payconiq.com/qrcode?s=L&c="+encodeURIComponent(this.paymentUrl);
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

    .payconiq-banner-view {
        padding: 40px 30px;
        background: $color-payconiq;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        --st-sheet-width: 380px;

        .payconiq-close {
            color: $color-payconiq-dark-original;
            position: absolute;
            top: 15px;
            right: 15px;
        }

        > h1 {
            font-size: 25px;
            font-weight: bold;
            color: white;
            line-height: 1.5;
        }

        .payconiq-logo {
            width: 150px;
            height: 150px;
            background: url(~@stamhoofd/assets/images/partners/payconiq/app-shadow.svg) no-repeat center center;
            background-size: contain;
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

        p {
            color: $color-payconiq-dark-original;
            font-size: 16px;
            font-weight: 500;
        }

        .install {
            margin-bottom: 15px;;
        }

        .price-loading {
            --color-primary: white;
        }

        .price {
            color: white;
            font-size: 25px;
            font-weight: bold;
            margin: 20px 0;
        }
    }
</style>