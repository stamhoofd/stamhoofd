import { ComponentWithProperties } from '@browser/navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type {ViewStep, ViewStepNavigation} from '#steps/ViewStep.ts';
import type { RegisterCheckout } from '@stamhoofd/structures';
import type { NavigationActions } from '../../../types/NavigationActions';


export class PaymentCustomerStep implements ViewStep {
    checkout: RegisterCheckout;

    constructor(checkout: RegisterCheckout) {
        this.checkout = checkout;
    }

    isEnabled() {
        if (this.checkout.isAdminFromSameOrganization) {
            return false;
        }

        if (!this.checkout.asOrganizationId) {
            return false;
        }

        return true;
    }

    getComponent(navigation: ViewStepNavigation): ComponentWithProperties {
        return AsyncComponent(() => import('../PaymentCustomerView.vue'), {
            checkout: this.checkout,
            saveHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate);
            },
        });
    }
}
