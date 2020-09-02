<template>
    <div class="payconiq-banner-view">
        <button class="payconiq-close button icon close white" @click="close"/>
        <h1>Scan en betaal met Payconiq by Bancontact</h1>

        <div class="payconiq-logo" />

        <div class="qr-code" :class="{ scanned: payment.status == 'Pending'}">
            <img :src="qrCodeSrc" v-if="payment.status == 'Pending' || payment.status == 'Created'"/>
        </div>

        <LoadingButton :loading="payment && payment.status == 'Pending'" class="price-loading">
            <p class="price">
                {{ price | price }}
            </p>
        </LoadingButton>

        <p>Of gebruik de app van</p>
        <p><a class="button simple" href="https://www.kbc.be/particulieren/nl/product/betalen/zelf-bankieren/payconiq.html" target="_blank">KBC<span class="icon help"/></a> <a class="button simple" href="https://www.ing.be/nl/retail/daily-banking/e-banking/payconiq" target="_blank">ING<span class="icon help"/></a></p>
    </div>
</template>

<script lang="ts">
import { NavigationMixin, ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { STFloatingFooter, LoadingButton, STNavigationBar, EmailInput, Validator, ErrorBox, Toast, STErrorsDefault } from "@stamhoofd/components"
import { Component, Mixins, Prop } from "vue-property-decorator";
import { SessionManager, Session } from '@stamhoofd/networking';
import { ForgotPasswordRequest, EncryptedPaymentDetailed, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Decoder } from '@simonbackx/simple-encoding';
import { MemberManager } from '../../classes/MemberManager';
import RegistrationSuccessView from './RegistrationSuccessView.vue';

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

    @Prop({ default: null })
    initialPayment: EncryptedPaymentDetailed | null

    payment: EncryptedPaymentDetailed | null = this.initialPayment

    @Prop({})
    presentingController: NavigationController;

    pollCount = 0
    timer: any = null

    loading = false

    mounted() {
        this.timer = setTimeout(this.poll.bind(this), 3000);
    }

    close() {
        if (confirm("Probeer alleen opnieuw als je zeker bent dat je niet hebt betaald! Anders moet je gewoon even wachten.")) {
            this.pop();
        }
    }

    get price() {
        return this.payment?.price ?? 0
    }

    poll() {
        this.timer = null;
        const paymentId = this.payment?.id ?? new URL(window.location.href).searchParams.get("id");
        SessionManager.currentSession!.authenticatedServer
            .request({
                method: "POST",
                path: "/payments/" +paymentId,
                decoder: EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>,
            }).then(response => {
                const payment = response.data
                if (payment.status == PaymentStatus.Succeeded) {
                    MemberManager.getRegistrationsWithMember(payment.registrations).then( (registrations) => {
                        this.presentingController.push(new ComponentWithProperties(RegistrationSuccessView, { registrations }), true, 1)
                        this.dismiss()
                    }).catch(e => {
                        console.error(e)
                    })  
                }

                if (payment.status == PaymentStatus.Failed) {
                    // todo: temporary message
                    this.dismiss()
                }
                this.payment = payment
            }).catch(e => {
                // too: handle this
                console.error(e)
            }).finally(() => {
                this.pollCount++;
                if (this.payment && (this.payment.status == PaymentStatus.Succeeded || this.payment.status == PaymentStatus.Failed)) {
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
    }

    get qrCodeSrc() {
        return "https://portal.payconiq.com/qrcode?s=L&c="+encodeURIComponent(this.paymentUrl);
    }

}
</script>

<style lang="scss">
    .payconiq-banner-view {
        padding: 40px 30px;
        background: #FF4785;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;

        .payconiq-close {
            color: #692038;
            position: absolute;
            top: 15px;
            right: 15px;
        }

        > h1 {
            font-size: 25px;
            font-weight: bold;
            color: white;
        }

        .payconiq-logo {
            width: 150px;
            height: 150px;
            background: url(~@stamhoofd/assets/images/partners/payconiq/payconiq_by_Bancontact-logo-app-pos-shadow.png) no-repeat center center;
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
                width: 250px;
                height: 250px;
            }
            margin-bottom: 20px;

            &.scanned {
                img {
                    opacity: 0.5;
                }
            }
        }

        p {
            color: #692038;
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