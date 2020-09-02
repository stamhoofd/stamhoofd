<template>
    <div class="payconiq-banner-view">
        <button class="payconiq-close button icon close white" @click="dismiss"/>
        <h1>Scan en betaal met Payconiq by Bancontact</h1>

        <div class="payconiq-logo" />

        <div class="qr-code">
            <img :src="qrCodeSrc"/>
        </div>

        <LoadingButton :loading="loading" >
            <p class="price" @click="test">
                € 40,00
            </p>
        </LoadingButton>

        <p>Of gebruik de app van</p>
        <p>KBC<span class="icon help"/> ING<span class="icon help"/></p>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STFloatingFooter, LoadingButton, STNavigationBar, EmailInput, Validator, ErrorBox, Toast, STErrorsDefault } from "@stamhoofd/components"
import { Component, Mixins, Prop } from "vue-property-decorator";
import { SessionManager, Session } from '@stamhoofd/networking';
import { ForgotPasswordRequest } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        EmailInput,
        LoadingButton,
        STErrorsDefault
    }
})
export default class PayconiqBannerView extends Mixins(NavigationMixin){
    @Prop({})
    paymentUrl: string;

    loading = false

    test() {
        this.loading = !this.loading
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
        }

        p {
            color: #692038;
            font-size: 20px;
            font-weight: 500;
        }

        .price {
            color: white;
            font-size: 25px;
            font-weight: bold;
            margin: 20px 0;
        }
    }
</style>