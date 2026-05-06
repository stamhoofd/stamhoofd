import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { ViewStep } from '@stamhoofd/components/steps/ViewStep';
import type { ViewStepsManager } from '@stamhoofd/components/steps/ViewStepsManager';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { PackageCheckout } from '@stamhoofd/structures';
import PackageOverviewStepView from './PackageOverviewStepView.vue';

export class PackageOverviewStep implements ViewStep {
    checkout: PackageCheckout;

    constructor({checkout}: { checkout: PackageCheckout }) {
        this.checkout = checkout;
    }

    isEnabled(_manager: ViewStepsManager) {
        return !this.checkout.purchases.empty;
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(PackageOverviewStepView, {
            checkout: this.checkout,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
