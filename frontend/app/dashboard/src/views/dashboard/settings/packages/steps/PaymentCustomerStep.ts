import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import PaymentCustomerView from '@stamhoofd/components/members/checkout/PaymentCustomerView.vue';
import type { ViewStep } from '@stamhoofd/components/steps/ViewStep';
import type { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { Checkoutable } from '@stamhoofd/structures';

export class PaymentCustomerStep implements ViewStep {
    checkout: Checkoutable;
    invoicesEnabled: boolean

    constructor({checkout, invoicesEnabled}: { checkout: Checkoutable; invoicesEnabled: boolean }) {
        this.checkout = checkout;
        this.invoicesEnabled = invoicesEnabled;
    }

    isEnabled(_manager: ViewStepsManager) {
        return true;
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(PaymentCustomerView, {
            checkout: this.checkout,
            invoicesEnabled: this.invoicesEnabled,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
