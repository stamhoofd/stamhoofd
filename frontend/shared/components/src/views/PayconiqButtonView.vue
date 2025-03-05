<template>
    <div class="st-view payconiq-button-view">
        <STNavigationBar :title="$t(`911fe3a2-12b5-44f2-a1bc-a6703d8ed8c0`)"/>

        <main>
            <h1>{{ $t('e67afedd-e865-4219-a19c-e1860b37039a') }}</h1>
            <p class="style-description">
                {{ $t('1762e5f6-f097-43e7-99c0-308fdc6f56f9') }}
            </p>
            <p class="style-description">
                {{ $t("01b1ab64-b83b-46be-89a3-76eecf19c0b6") }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="helpMe">
                    <span class="icon help"/>
                    <span>{{ $t('f128ae83-80bf-4050-aa1e-a22f9fd9d873') }}</span>
                </button>
                <LoadingButton :loading="payment && payment.status === 'Pending'">
                    <a :href="paymentUrl" class="button primary open-app">
                        <span class="icon external"/><span>{{ $t('f77f6b13-71bf-4268-9373-555acad8c31d') }}</span>
                    </a>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { CenteredMessage, EmailInput, LoadingButton, STErrorsDefault, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Component, Prop, Mixins } from '@simonbackx/vue-app-navigation/classes';

import PayconiqBannerView from './PayconiqBannerView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        EmailInput,
        LoadingButton,
        STErrorsDefault,
    },
})
export default class PayconiqButtonView extends Mixins(PayconiqBannerView) {
    @Prop({})
    paymentUrl: string;

    getOS(): string {
        var userAgent = navigator.userAgent || navigator.vendor;

        if (/android/i.test(userAgent)) {
            return 'android';
        }

        if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
            // Different sms protocol
            return 'macOS-old';
        }

        // iOS detection from: http://stackoverflow.com/a/9039885/177710
        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
            return 'iOS';
        }

        // iPad on iOS 13 detection
        if (navigator.userAgent.includes('Mac') && 'ontouchend' in document) {
            return 'iOS';
        }

        if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
            return 'macOS';
        }

        if (navigator.platform.toUpperCase().indexOf('WIN') >= 0) {
            return 'windows';
        }

        if (navigator.platform.toUpperCase().indexOf('IPHONE') >= 0) {
            return 'iOS';
        }

        if (navigator.platform.toUpperCase().indexOf('ANDROID') >= 0) {
            return 'android';
        }

        return 'unknown';
    }

    get isIOS() {
        return this.getOS() === 'iOS';
    }

    helpMe() {
        if (this.getOS() === 'iOS') {
            new CenteredMessage('Het lukt niet', "Kijk na of je één van de apps bovenaan deze pagina hebt geïnstalleerd. Als je op een pagina terecht komt die zegt dat je de app niet hebt: sleep die pagina naar beneden tot er een grijze balk tevoorschijn komt, klik daar op 'Open'. Probeer eventueel opnieuw op een computer of selecteer een andere betaalmethode.")
                .addCloseButton()
                .show();
        }
        else {
            new CenteredMessage('Het lukt niet', 'Kijk na of je één van de apps bovenaan deze pagina hebt geïnstalleerd. Probeer eventueel opnieuw op een computer (daar kan je de QR-code scannen) of selecteer een andere betaalmethode.').addCloseButton().show();
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
