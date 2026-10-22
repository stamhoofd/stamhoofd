import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

import type { ViewStep, ViewStepNavigation } from '@stamhoofd/components/steps/ViewStep';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';

export class PaymentCustomerStep implements ViewStep {
    model: OrganizationCheckoutViewModel;

    constructor({model}: { model: OrganizationCheckoutViewModel;}) {
        this.model = model;
    }

    isEnabled() {
        return true;
    }

    getComponent(navigation: ViewStepNavigation): ComponentWithProperties {
        return AsyncComponent(() => import('@stamhoofd/components/members/checkout/PaymentCustomerView.vue'), {
            checkout: this.model.checkout,
            invoicesEnabled: this.model.sellingOrganization.meta.invoicesEnabled,

            // for periodic payments, you cannot change as periodic payhments will always use the default company
            // we don't allow choosing non-default when balance items are selected, because this could affect VAT calculation
            // of existing balance items
            allowNonDefault: !this.model.requiresMandate && this.model.checkout.balances.size === 0,
            saveHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate);
            },
        });
    }
}
