<template>
    <div class="st-view payconiq-button-view">
        <STNavigationBar title="Payconiq by Bancontact">
            <template #right><button class="button icon gray close" type="button" @click="close" /></template>
        </STNavigationBar>

        <main>
            <h1>Betaal met Payconiq by Bancontact</h1>
            <p class="style-description">Je hebt één van volgende apps nodig om te kunnen betalen: Payconiq by Bancontact, KBC Mobile, ING Banking, Belfius, BNP Paribas Fortis, Fintro, Hello Bank!, Argenta of Crelan.</p>
            <p class="style-description">Klik op de volgende pagina op 'Kies een andere app' als je met een andere app dan Payconiq by Bancontact wilt betalen.</p>
        </main>

        <STToolbar>
            <template #right><button class="button secundary" type="button" @click="helpMe">
                <span class="icon help" />
                <span>Het lukt niet</span>
            </button></template>
            <LoadingButton slot="right" :loading="payment && payment.status == 'Pending'">
                <a :href="paymentUrl" class="button primary open-app">
                    <span class="icon external" /><span>Open de app</span>
                </a>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { CenteredMessage,EmailInput, LoadingButton, STErrorsDefault, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Component, Prop, Mixins } from "vue-property-decorator";

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
export default class PayconiqButtonView extends Mixins(PayconiqBannerView) {
    @Prop({})
        paymentUrl: string;

    getOS(): string {
        var userAgent = navigator.userAgent || navigator.vendor;

        if (/android/i.test(userAgent)) {
            return "android";
        }

        if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
            // Different sms protocol
            return "macOS-old";
        }

        // iOS detection from: http://stackoverflow.com/a/9039885/177710
        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
            return "iOS";
        }

        // iPad on iOS 13 detection
        if (navigator.userAgent.includes("Mac") && "ontouchend" in document) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().indexOf('MAC')>=0 ) {
            return "macOS";
        }

        if (navigator.platform.toUpperCase().indexOf('WIN')>=0 ) {
            return "windows";
        }

        if (navigator.platform.toUpperCase().indexOf('IPHONE')>=0 ) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().indexOf('ANDROID')>=0 ) {
            return "android";
        }

        return "unknown"
    }

    get isIOS() {
        return this.getOS() == "iOS"
    }

    helpMe() {
        if (this.getOS() == "iOS") {
            new CenteredMessage("Het lukt niet", "Kijk na of je één van de apps bovenaan deze pagina hebt geïnstalleerd. Als je op een pagina terecht komt die zegt dat je de app niet hebt: sleep die pagina naar beneden tot er een grijze balk tevoorschijn komt, klik daar op 'Open'. Probeer eventueel opnieuw op een computer of selecteer een andere betaalmethode.")
                .addCloseButton()
                .show()
        } else {
            new CenteredMessage("Het lukt niet", "Kijk na of je één van de apps bovenaan deze pagina hebt geïnstalleerd. Probeer eventueel opnieuw op een computer (daar kan je de QR-code scannen) of selecteer een andere betaalmethode.").addCloseButton().show()
        }
    }
}
</script>

<style lang="scss">
.payconiq-button-view {
    --color-primary: #FF4785;

    .payment-app-logo {
        height: 28px;
    }

    .open-app {
        // Prevent opening in a new tab -> breaks opening
        -webkit-touch-callout: none;
    }
}


</style>