import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import PaymentCustomerView from '@stamhoofd/components/members/checkout/PaymentCustomerView.vue';
import type { ViewStep } from '@stamhoofd/components/steps/ViewStep';
import type { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { PackageCheckoutViewModel } from '../PackageCheckoutViewModel';

export class PaymentCustomerStep implements ViewStep {
    model: PackageCheckoutViewModel;

    constructor({model}: { model: PackageCheckoutViewModel;}) {
        this.model = model;
    }

    isEnabled(_manager: ViewStepsManager) {
        return true;
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(PaymentCustomerView, {
            checkout: this.model.checkout,
            invoicesEnabled: this.model.sellingOrganization.meta.invoicesEnabled,
            allowNonDefault: !this.model.requiresMandate, // for periodic payments, you cannot change as periodic payhments will always use the default company
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
