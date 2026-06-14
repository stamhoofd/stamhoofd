import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type {ViewStep} from '#steps/ViewStep.ts';
import type {ViewStepsManager} from '#steps/ViewStepsManager.ts';
import type { RegisterCheckout } from '@stamhoofd/structures';
import type { NavigationActions } from '../../../types/NavigationActions';


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
        return AsyncComponent(() => import('../PaymentCustomerView.vue'), {
            checkout: this.checkout,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
