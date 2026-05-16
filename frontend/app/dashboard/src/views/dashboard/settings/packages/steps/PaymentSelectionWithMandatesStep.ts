import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { ViewStep } from '@stamhoofd/components/steps/ViewStep';
import type { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';
import PaymentSelectionWithMandatesStepView from './PaymentSelectionWithMandatesStepView.vue';

export class PaymentSelectionWithMandatesStep implements ViewStep {
    model: OrganizationCheckoutViewModel;

    constructor({model}: { model: OrganizationCheckoutViewModel;}) {
        this.model = model;
    }

    isEnabled(_manager: ViewStepsManager) {
        return true;
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(PaymentSelectionWithMandatesStepView, {
            model: this.model,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
