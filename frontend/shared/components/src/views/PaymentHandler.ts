import { Server } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Organization, Payment, PaymentMethod, PaymentProvider, PaymentStatus, TransferSettings } from "@stamhoofd/structures";

import PayconiqBannerView from "./PayconiqBannerView.vue"
import PayconiqButtonView from "./PayconiqButtonView.vue"
import TransferPaymentView from "./TransferPaymentView.vue"

export class PaymentHandler {
    static getOS(): string {
        const userAgent = navigator.userAgent || navigator.vendor;

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

        if (navigator.platform.toUpperCase().includes('MAC') ) {
            return "macOS";
        }

        if (navigator.platform.toUpperCase().includes('WIN') ) {
            return "windows";
        }

        if (navigator.platform.toUpperCase().includes('IPHONE') ) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().includes('ANDROID') ) {
            return "android";
        }

        return "unknown"
    }

    static handlePayment(settings: { 
        server: Server; 
        organization: Organization; 
        payment: Payment; 
        returnUrl: string | null;
        paymentUrl: string | null; 
        transferSettings: TransferSettings | null;
        component: NavigationMixin; 
        type: "order" | "registration";
    }, successHandler: (payment: Payment, component: NavigationMixin) => void, failedHandler: (payment: Payment | null) => void, transferHandler?: (payment: Payment | null) => void) {
        const {payment, organization, server, component, paymentUrl, returnUrl, transferSettings } = settings;

        if (payment.method == PaymentMethod.PointOfSale) {
            successHandler(payment, component)
        } else if (payment.method == PaymentMethod.Transfer) {
            if (transferHandler) {
                transferHandler(payment)
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            component.show(new ComponentWithProperties(TransferPaymentView, {
                created: true,
                type: settings.type,
                organization,
                payment,
                settings: transferSettings,
                finishedHandler: (payment: Payment, component: NavigationMixin) => {
                    // Always go to success
                    successHandler(payment, component)
                }
            }))
        } else if (payment.provider == PaymentProvider.Payconiq) {
            if (this.getOS() == "android" || this.getOS() == "iOS") {
                const url = paymentUrl+"?returnUrl="+encodeURIComponent(returnUrl ? returnUrl : "https://"+window.location.hostname+"/payment?id="+encodeURIComponent(payment.id)) 
                
                // only on desktop
                const buttonComponent = new ComponentWithProperties(PayconiqButtonView, { 
                    paymentUrl: url, 
                    server,
                    initialPayment: payment,
                    finishedHandler: (payment: Payment | null) => {
                        if (payment && payment.status == PaymentStatus.Succeeded) {
                            successHandler(payment, component) // use component because payconiq closed itself + was a sheet
                        } else {
                            failedHandler(payment)
                        }
                    }
                }).setDisplayStyle("sheet")
                component.present(buttonComponent)
                //this.loading = false;
                return;
                
            } else {
                // only on desktop
                const bannerComponent = new ComponentWithProperties(PayconiqBannerView, { 
                    paymentUrl, 
                    server,
                    initialPayment: payment,
                    finishedHandler: (payment: Payment | null) => {
                        if (payment && payment.status == PaymentStatus.Succeeded) {
                            successHandler(payment, component) // use component because payconiq closed itself + was a sheet
                        } else {
                            failedHandler(payment)
                        }
                    }
                }).setDisplayStyle("sheet")
                component.present(bannerComponent)
                //this.loading = false;
                return;
            }
        } else {
            if (paymentUrl) {
                window.location.href = paymentUrl;
            }
        }
    }

}