<template>
    <div class="st-view payconiq-button-view">
        <STNavigationBar :title="$t(`a4dde8e6-d0f7-4ad6-b880-cf5467771770`)" />

        <main>
            <h1>{{ $t('7e35e52f-d862-4775-b24e-394e20470880') }}</h1>
            <p class="style-description">
                {{ $t('b3bdadbd-5c9c-461d-8607-6f9cd5c2640d') }}
            </p>
            <p class="style-description">
                {{ $t("630a85b7-2e2a-4e94-a8a2-f77bd80b78ed") }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="helpMe">
                    <span class="icon help" />
                    <span>{{ $t('809b7c07-e6fb-4d65-806d-7ec52cc8b3b8') }}</span>
                </button>
                <LoadingButton :loading="payment && payment.status === 'Pending'">
                    <a :href="paymentUrl" class="button primary open-app">
                        <span class="icon external" /><span>{{ $t('ab4cda2d-03fa-4e19-a4a5-5ec2fe0d7187') }}</span>
                    </a>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, EmailInput, LoadingButton, STErrorsDefault, STNavigationBar, STToolbar } from '@stamhoofd/components';

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
