import { Server } from '@simonbackx/simple-networking';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { Organization, Payment, PaymentMethod, PaymentProvider, PaymentStatus, TransferSettings } from '@stamhoofd/structures';

import { NavigationActions } from '../types/NavigationActions';
import PayconiqBannerView from './PayconiqBannerView.vue';
import PayconiqButtonView from './PayconiqButtonView.vue';
import TransferPaymentView from './TransferPaymentView.vue';
import { GlobalEventBus } from '../EventBus';

export class PaymentHandler {
    static getOS(): string {
        const userAgent = navigator.userAgent || navigator.vendor;

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

        if (navigator.platform.toUpperCase().includes('MAC')) {
            return 'macOS';
        }

        if (navigator.platform.toUpperCase().includes('WIN')) {
            return 'windows';
        }

        if (navigator.platform.toUpperCase().includes('IPHONE')) {
            return 'iOS';
        }

        if (navigator.platform.toUpperCase().includes('ANDROID')) {
            return 'android';
        }

        return 'unknown';
    }

    static async handlePayment(
        settings: {
            server: Server;
            organization: Organization;
            payment: Payment;
            paymentUrl: string | null;
            paymentQRCode: string | null;
            transferSettings: TransferSettings | null;
            navigate: NavigationActions;
            type: 'order' | 'registration';
        },
        successHandler: (payment: Payment, navigate: NavigationActions) => void | Promise<void>,
        failedHandler: (payment: Payment | null) => void | Promise<void>,
        transferHandler?: (payment: Payment | null) => void | Promise<void>,
    ) {
        const { payment, organization, server, navigate, paymentUrl, paymentQRCode, transferSettings } = settings;
        GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);

        if (payment.method == PaymentMethod.PointOfSale) {
            successHandler(payment, navigate)?.catch(console.error);
        }
        else if (payment.method == PaymentMethod.Transfer) {
            if (transferHandler) {
                transferHandler(payment)?.catch(console.error);
            }

            await navigate.show(new ComponentWithProperties(TransferPaymentView, {
                created: true,
                type: settings.type,
                organization,
                payment,
                settings: transferSettings,
                finishedHandler: (payment: Payment, navigate: NavigationActions) => {
                    // Always go to success
                    successHandler(payment, navigate)?.catch(console.error);
                },
            }));
        }
        else if (payment.provider == PaymentProvider.Payconiq && paymentUrl) {
            if (!paymentQRCode || this.getOS() == 'android' || this.getOS() == 'iOS') {
                // we need this view for polling
                const buttonComponent = new ComponentWithProperties(PayconiqButtonView, {
                    paymentUrl,
                    server,
                    initialPayment: payment,
                    finishedHandler: (payment: Payment | null) => {
                        GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
                        if (payment && payment.status == PaymentStatus.Succeeded) {
                            successHandler(payment, navigate)?.catch(console.error); // use component because payconiq closed itself + was a sheet
                        }
                        else {
                            failedHandler(payment)?.catch(console.error);
                        }
                    },
                }).setDisplayStyle('sheet');
                await navigate.present(buttonComponent);
                return;
            }
            else {
                // only on desktop
                const bannerComponent = new ComponentWithProperties(PayconiqBannerView, {
                    paymentUrl: paymentQRCode,
                    server,
                    initialPayment: payment,
                    finishedHandler: (payment: Payment | null) => {
                        GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
                        if (payment && payment.status == PaymentStatus.Succeeded) {
                            successHandler(payment, navigate)?.catch(console.error); // use component because payconiq closed itself + was a sheet
                        }
                        else {
                            failedHandler(payment)?.catch(console.error);
                        }
                    },
                }).setDisplayStyle('sheet');
                await navigate.present(bannerComponent);
                return;
            }
        }
        else {
            if (paymentUrl) {
                window.location.href = paymentUrl;
            }
        }
    }
}
