<template>
    <div class="st-view payconiq-button-view">
        <STNavigationBar title="Betaal met Payconiq by Bancontact">
            <button slot="right" class="button icon gray close" @click="dismiss" type="button"></button>
        </STNavigationBar>

        <main>
            <h1>Betaal met Payconiq by Bancontact</h1>

            <div class="payconiq-logo" />
        </main>

        <STToolbar>
            <LoadingButton slot="right" :loading="payment && payment.status == 'Pending'">
                <a :href="paymentUrl" class="button primary">
                    <span class="icon external" /><span>Open de app</span>
                </a>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { STToolbar, LoadingButton, STNavigationBar, EmailInput, STErrorsDefault } from "@stamhoofd/components"
import { Component, Prop } from "vue-property-decorator";
import PayconiqBannerView from "./PayconiqBannerView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        EmailInput,
        LoadingButton,
        STErrorsDefault
    }
})
export default class PayconiqButtonView extends PayconiqBannerView {
    @Prop({})
    paymentUrl: string;

}
</script>

<style lang="scss">
    .payconiq-button-view {
        --color-primary: #FF4785;

        .payconiq-logo {
            width: 150px;
            height: 150px;
            background: url(~@stamhoofd/assets/images/partners/payconiq/payconiq_by_Bancontact-logo-app-pos-shadow.png) no-repeat center center;
            background-size: contain;
        }

       
    }
</style>