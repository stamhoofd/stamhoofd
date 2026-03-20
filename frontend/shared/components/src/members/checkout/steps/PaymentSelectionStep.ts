import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type {ViewStep} from '#steps/ViewStep.ts';
import type {ViewStepsManager} from '#steps/ViewStepsManager.ts';
import type { RegisterCheckout } from '@stamhoofd/structures';
import type { NavigationActions } from '../../../types/NavigationActions';
import PaymentSelectionView from '../PaymentSelectionView.vue';

export class PaymentSelectionStep implements ViewStep {
    checkout: RegisterCheckout;

    constructor(checkout: RegisterCheckout) {
        this.checkout = checkout;
    }

    isEnabled(_manager: ViewStepsManager) {
        if (this.checkout.isAdminFromSameOrganization) {
            return false;
        }

        return true;
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(PaymentSelectionView, {
            checkout: this.checkout,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
