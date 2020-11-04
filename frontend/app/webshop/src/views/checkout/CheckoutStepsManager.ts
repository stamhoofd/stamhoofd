import { CheckoutMethodType } from '@stamhoofd/structures';

import { CheckoutManager } from '../../classes/CheckoutManager';
import { WebshopManager } from '../../classes/WebshopManager';
import AddressSelectionView from "./AddressSelectionView.vue"
import CheckoutMethodSelectionView from "./CheckoutMethodSelectionView.vue"
import PaymentSelectionView from "./PaymentSelectionView.vue"
import TimeSelectionView from "./TimeSelectionView.vue"

export enum CheckoutStepType {
    "Method" = "Method",
    "Address" = "Address",
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

    getComponent(): any {
        switch (this.type) {
            case CheckoutStepType.Method: return CheckoutMethodSelectionView;
            case CheckoutStepType.Address: return AddressSelectionView;
            case CheckoutStepType.Time: return TimeSelectionView;
            case CheckoutStepType.Payment: return PaymentSelectionView;

            default: {
                // If you get a compile error here, a type is missing in the switch and you should add it
                const t: never = this.type
                throw new Error("Missing component for "+t)
            }
        }
    }
}

export class CheckoutStepsManager {
    /// Return all the steps that are confirmed with the current checkout configuration
    static getActiveSteps(): CheckoutStep[] {
        const webshop = WebshopManager.webshop
        const checkout = CheckoutManager.checkout
        const checkoutMethod = checkout.checkoutMethod ?? webshop.meta.checkoutMethods[0]

        if (!checkoutMethod) {
            // Missing configs
            return []
        }

        const steps: CheckoutStep[] = []


        steps.push(
            new CheckoutStep(
                CheckoutStepType.Method,
                webshop.meta.checkoutMethods.length > 1,
                () => {
                    // Skip behaviour
                    // Set to the only available checkout method
                    CheckoutManager.checkout.checkoutMethod = WebshopManager.webshop.meta.checkoutMethods[0]
                    CheckoutManager.saveCheckout()
                }
            )
        )

        steps.push(
            new CheckoutStep(
                CheckoutStepType.Address,
                checkoutMethod.type == CheckoutMethodType.Delivery,
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
                checkoutMethod.timeSlots.timeSlots.length > 1,
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

        steps.push(new CheckoutStep(CheckoutStepType.Payment))

        return steps
    }

    static getNextStep(step: CheckoutStepType | undefined, runSkip = false) {
        const steps = this.getActiveSteps()
        if (!step) {
            return steps[0]
        }
        let next = false
        for (const s of steps) {
            if (next) {
                if (s.active) {
                    return s
                }
                if (runSkip) {
                    s.skipHandler()
                }
                continue
            }
            if (s.type === step) {
                next = true
            }
        }

        // Last step
        return undefined
    }
}