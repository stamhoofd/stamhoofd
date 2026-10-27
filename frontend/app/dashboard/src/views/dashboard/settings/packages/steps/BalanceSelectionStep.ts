import { ComponentWithProperties } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { ViewStep, ViewStepNavigation } from '@stamhoofd/components/steps/ViewStep';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';
import { PayBalanceMode } from '../OrganizationCheckoutViewModel';


export class BalanceSelectionStep implements ViewStep {
    model: OrganizationCheckoutViewModel;

    constructor({model}: { model: OrganizationCheckoutViewModel;}) {
        this.model = model;
    }

    isEnabled() {
        if (this.model.payBalanceMode === PayBalanceMode.None) {
            return false;
        }

        return this.model.payableBalance.payableBalanceItems.length > 0 || !!this.model.checkout.balances.size
    }

    getComponent(navigation: ViewStepNavigation): ComponentWithProperties {
        return AsyncComponent(() => import('./BalanceSelectionStepView.vue'), {
            model: this.model,
            saveHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate);
            },
        });
    }
}
