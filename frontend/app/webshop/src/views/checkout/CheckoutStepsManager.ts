import { Checkout, CheckoutMethod, CheckoutMethodType, OrganizationMetaData, Webshop } from '@stamhoofd/structures';

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';

export enum CheckoutStepType {
    "Method" = "Method",
    "Address" = "Address",
    "Customer" = "Customer",
    "Time" = "Time",
    "Payment" = "Payment",
}

export class CheckoutStep {
    type: CheckoutStepType
    active: boolean
    skipHandler: () => void

    constructor(type: CheckoutStepType, active = true , skipHandler: () => void = () => { /* */ }) {
        this.type = type
        this.active = active
        this.skipHandler = skipHandler
    }

    async getComponent(): Promise<any> {
        switch (this.type) {
            case CheckoutStepType.Method: return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CheckoutMethodSelectionView.vue')).default;
            case CheckoutStepType.Address: return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './AddressSelectionView.vue')).default;
            case CheckoutStepType.Time:return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './TimeSelectionView.vue')).default;
            case CheckoutStepType.Payment: return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './PaymentSelectionView.vue')).default;
            case CheckoutStepType.Customer: return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CustomerView.vue')).default;

            default: {
                // If you get a compile error here, a type is missing in the switch and you should add it
                const t: never = this.type
                throw new Error("Missing component for "+t)
            }
        }
    }

    validate(checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) {
        switch (this.type) {
            case CheckoutStepType.Method: checkout.validateCheckoutMethod(webshop, organizationMeta); return;
            case CheckoutStepType.Address: checkout.validateDeliveryAddress(webshop, organizationMeta); return;
            case CheckoutStepType.Time: checkout.validateTimeSlot(webshop, organizationMeta); return;
            case CheckoutStepType.Payment: checkout.validate(webshop, organizationMeta); return;
            case CheckoutStepType.Customer: checkout.validateCustomer(webshop, organizationMeta); return;

            default: {
                // If you get a compile error here, a type is missing in the switch and you should add it
                const t: never = this.type
                throw new Error("Missing validate for "+t)
            }
        }
    }
}

export class CheckoutStepsManager {
    /// Return all the steps that are confirmed with the current checkout configuration
    static getSteps(): CheckoutStep[] {
        const webshop = WebshopManager.webshop
        const checkout = CheckoutManager.checkout
        const checkoutMethod = webshop.meta.checkoutMethods.find(m => m.id === checkout.checkoutMethod?.id) ?? (webshop.meta.checkoutMethods[0] as CheckoutMethod | undefined) ?? null;
        const steps: CheckoutStep[] = []

        steps.push(
            new CheckoutStep(
                CheckoutStepType.Method,
                webshop.meta.checkoutMethods.length > 1,
                () => {
                    // Skip behaviour
                    // Set to the only available checkout method
                    CheckoutManager.checkout.checkoutMethod = WebshopManager.webshop.meta.checkoutMethods.length == 0 ? null : WebshopManager.webshop.meta.checkoutMethods[0]
                    CheckoutManager.saveCheckout()
                }
            )
        )

        steps.push(
            new CheckoutStep(
                CheckoutStepType.Address,
                checkoutMethod !== null && checkoutMethod.type == CheckoutMethodType.Delivery,
                () => {
                    // Skip behaviour
                    // Clear address
                    CheckoutManager.checkout.address = null
                    CheckoutManager.saveCheckout()
                }
            )
        )

        steps.push(
            new CheckoutStep(
                CheckoutStepType.Time,
                checkoutMethod !== null && checkoutMethod.timeSlots.timeSlots.length > 1,
                () => {
                    // Use default or set to null if none available
                    if (CheckoutManager.checkout.checkoutMethod && CheckoutManager.checkout.checkoutMethod.timeSlots.timeSlots.length == 1) {
                        CheckoutManager.checkout.timeSlot = CheckoutManager.checkout.checkoutMethod.timeSlots.timeSlots[0]
                    } else {
                        CheckoutManager.checkout.timeSlot = null
                    }
                    
                    CheckoutManager.saveCheckout()
                }
            )
        )
        steps.push(new CheckoutStep(CheckoutStepType.Customer))
        steps.push(new CheckoutStep(CheckoutStepType.Payment))

        return steps
    }

    static getActiveSteps() {
        return this.getSteps().filter(s => s.active)
    }

    static getNextStep(step: CheckoutStepType | undefined) {
        const steps = this.getSteps()
        let next = step === undefined
        for (const s of steps) {
            if (next) {
                if (s.active) {
                    return s
                }
                s.skipHandler()
                continue
            }

            // Validate all steps along the way
            s.validate(CheckoutManager.checkout, WebshopManager.webshop, WebshopManager.organization.meta)
            if (s.type === step) {
                next = true
            }
        }

        // Last step
        return undefined
    }
}