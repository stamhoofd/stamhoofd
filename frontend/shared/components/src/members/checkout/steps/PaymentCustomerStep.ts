import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { type ViewStep } from '#steps/ViewStep';
import { type ViewStepsManager } from '#steps/ViewStepsManager';
import { RegisterCheckout } from '@stamhoofd/structures';
import { NavigationActions } from '../../../types/NavigationActions';
import PaymentCustomerView from '../PaymentCustomerView.vue';

export class PaymentCustomerStep implements ViewStep {
    checkout: RegisterCheckout;

    constructor(checkout: RegisterCheckout) {
        this.checkout = checkout;
    }

    isEnabled(_manager: ViewStepsManager) {
        if (this.checkout.isAdminFromSameOrganization) {
            return false;
        }

        if (!this.checkout.asOrganizationId) {
            return false;
        }

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
