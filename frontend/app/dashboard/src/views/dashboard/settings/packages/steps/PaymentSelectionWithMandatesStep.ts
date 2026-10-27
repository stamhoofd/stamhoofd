import { ComponentWithProperties } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { ViewStep, ViewStepNavigation } from '@stamhoofd/components/steps/ViewStep';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';


export class PaymentSelectionWithMandatesStep implements ViewStep {
    model: OrganizationCheckoutViewModel;

    constructor({model}: { model: OrganizationCheckoutViewModel;}) {
        this.model = model;
    }

    isEnabled() {
        return true;
    }

    getComponent(navigation: ViewStepNavigation): ComponentWithProperties {
        return AsyncComponent(() => import('./PaymentSelectionWithMandatesStepView.vue'), {
            model: this.model,
            saveHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate);
            },
        });
    }
}
