<template>
    <div class="st-view payconiq-button-view">
        <STNavigationBar :title="$t(`Bancontact Pay`)" />

        <main>
            <h1>{{ $t('Betaal met Bancontact Pay') }}</h1>
            <p class="style-description">
                {{ $t('%kH') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="helpMe">
                    <span class="icon help" />
                    <span>{{ $t('%kI') }}</span>
                </button>
                <LoadingButton :loading="payment && payment.status === 'Pending'">
                    <a :href="paymentUrl" class="button primary open-app">
                        <span class="icon external" /><span>{{ $t('%kJ') }}</span>
                    </a>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import EmailInput from '#inputs/EmailInput.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

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
            new CenteredMessage($t(`%kI`), $t(`%12g`))
                .addCloseButton()
                .show();
        }
        else {
            new CenteredMessage($t(`%kI`), $t(`%12h`)).addCloseButton().show();
        }
    }
}
</script>

<style lang="scss">
.payconiq-button-view {
    .payment-app-logo {
        height: 28px;
    }

    .open-app {
        // Prevent opening in a new tab -> breaks opening
        -webkit-touch-callout: none;
    }
}

</style>
