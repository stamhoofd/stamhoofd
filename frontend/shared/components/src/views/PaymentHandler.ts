import { Server } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Organization, Payment, PaymentMethod, PaymentStatus } from "@stamhoofd/structures";

import PayconiqBannerView from "./PayconiqBannerView.vue"
import PayconiqButtonView from "./PayconiqButtonView.vue"
import PaymentPendingView from "./PaymentPendingView.vue"
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
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
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
        component: NavigationMixin; 
    }, successHandler: (payment: Payment) => void, failedHandler: (payment: Payment | null) => void) {
        let finishedHandler: (() => void) | null = null
        const {payment, organization, server, component, paymentUrl, returnUrl } = settings;

        if (payment.method == PaymentMethod.Transfer) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            component.navigationController!.push(new ComponentWithProperties(TransferPaymentView, {
                organization,
                payment,
                finishedHandler: (payment: Payment) => {
                    if (finishedHandler) {
                        // hide payconiq button view if needed
                        finishedHandler()
                    }

                    // Always go to success
                    successHandler(payment)
                }
            }), true)
        } else if (payment.method == PaymentMethod.Payconiq) {
            if (this.getOS() == "android" || this.getOS() == "iOS") {
                const url = paymentUrl+"?returnUrl="+encodeURIComponent(returnUrl ? returnUrl : "https://"+window.location.hostname+"/payment?id="+encodeURIComponent(payment.id)) 
                const href = document.createElement("a")
                href.href = url
                
                let t = new Date().getTime()

                const listener = function() {
                    if (document.hidden) {
                        console.log("Detected hidden")
                        // Payconiq app has opened
                        t -= 3000
                    }
                };

                document.addEventListener("visibilitychange", listener);
                href.click();

                window.setTimeout(() => {
                    if (!document.hidden) {
                        const t2 = new Date().getTime()

                        if (t2 - t <= 3000) {
                            const payconiqComponent = new ComponentWithProperties(PayconiqButtonView, { 
                                paymentUrl: url
                            })
                            component.present(payconiqComponent);
                            finishedHandler = () => {
                                (payconiqComponent.componentInstance() as any)?.pop()
                            }
                        }
                    }
                    document.removeEventListener("visibilitychange", listener)
                }, 200)
                
            } else {
                // only on desktop
                const bannerComponent = new ComponentWithProperties(PayconiqBannerView, { 
                    paymentUrl, 
                    server,
                    initialPayment: payment,
                    finishedHandler: (payment: Payment | null) => {
                        if (finishedHandler) {
                            // hide payconiq button view if needed
                            finishedHandler()
                        }
                        if (payment && payment.status == PaymentStatus.Succeeded) {
                            successHandler(payment)
                        } else {
                            failedHandler(payment)
                        }
                    }
                }).setDisplayStyle("sheet")
                component.present(bannerComponent)
                //this.loading = false;
                return;
            }
            
            window.setTimeout(() => {
                //this.loading = false
                component.show(new ComponentWithProperties(PaymentPendingView, {
                    paymentId: payment.id,
                    finishedHandler: (payment: Payment) => {
                        if (finishedHandler) {
                            // hide payconiq button view if needed
                            finishedHandler()
                        }
                        if (payment.status == PaymentStatus.Succeeded) {
                            successHandler(payment)
                        } else {
                            failedHandler(payment)
                        }
                    }
                }))
            }, 2100)
        } else {
            if (paymentUrl) {
                window.location.href = paymentUrl;
            }
        }
    }

}