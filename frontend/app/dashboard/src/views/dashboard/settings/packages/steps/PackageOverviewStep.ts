import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { ViewStep, ViewStepNavigation } from '@stamhoofd/components/steps/ViewStep';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';


export class PackageOverviewStep implements ViewStep {
    model: OrganizationCheckoutViewModel;

    constructor({model}: { model: OrganizationCheckoutViewModel}) {
        this.model = model;
    }

    isEnabled() {
        return !this.model.checkout.purchases.empty;
    }

    getComponent(navigation: ViewStepNavigation): ComponentWithProperties {
        return AsyncComponent(() => import('./PackageOverviewStepView.vue'), {
            model: this.model,
            saveHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate);
            },
        });
    }
}
