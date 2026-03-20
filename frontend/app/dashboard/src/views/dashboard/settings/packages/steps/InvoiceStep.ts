import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { type ViewStep } from '@stamhoofd/components/steps/ViewStep';
import { type ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { PackageCheckout } from '@stamhoofd/structures';
import PaymentCustomerView from '@stamhoofd/components/members/checkout/PaymentCustomerView.vue';

export class InvoiceStep implements ViewStep {
    checkout: PackageCheckout;

    constructor(checkout: PackageCheckout) {
        this.checkout = checkout;
    }

    isEnabled(_manager: ViewStepsManager) {
        return true;
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(PaymentCustomerView, {
            checkout: this.checkout,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
