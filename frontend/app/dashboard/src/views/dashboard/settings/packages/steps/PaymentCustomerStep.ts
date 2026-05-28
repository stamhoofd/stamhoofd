import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import PaymentCustomerView from '@stamhoofd/components/members/checkout/PaymentCustomerView.vue';
import type { ViewStep } from '@stamhoofd/components/steps/ViewStep';
import type { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';

export class PaymentCustomerStep implements ViewStep {
    model: OrganizationCheckoutViewModel;

    constructor({model}: { model: OrganizationCheckoutViewModel;}) {
        this.model = model;
    }

    isEnabled(_manager: ViewStepsManager) {
        return true;
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(PaymentCustomerView, {
            checkout: this.model.checkout,
            invoicesEnabled: this.model.sellingOrganization.meta.invoicesEnabled,

            // for periodic payments, you cannot change as periodic payhments will always use the default company
            // we don't allow choosing non-default when balance items are selected, because this could affect VAT calculation
            // of existing balance items
            allowNonDefault: !this.model.requiresMandate && this.model.checkout.balances.size === 0,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
