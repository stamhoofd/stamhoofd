import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { ViewStep } from '@stamhoofd/components/steps/ViewStep';
import type { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';
import { PayBalanceMode } from '../OrganizationCheckoutViewModel';
import BalanceSelectionStepView from './BalanceSelectionStepView.vue';

export class BalanceSelectionStep implements ViewStep {
    model: OrganizationCheckoutViewModel;

    constructor({model}: { model: OrganizationCheckoutViewModel;}) {
        this.model = model;
    }

    isEnabled(_manager: ViewStepsManager) {
        if (this.model.payBalanceMode === PayBalanceMode.None) {
            return false;
        }

        return this.model.payableBalance.payableBalanceItems.length > 0 || !!this.model.checkout.balances.size
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(BalanceSelectionStepView, {
            model: this.model,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
