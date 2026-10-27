import { ComponentWithProperties } from '@browser/navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { RegisterCheckout } from '@stamhoofd/structures';
import type { NavigationActions } from '../../../types/NavigationActions';

import type {ViewStep, ViewStepNavigation} from '#steps/ViewStep.ts';

export class FreeContributionStep implements ViewStep {
    checkout: RegisterCheckout;

    constructor(checkout: RegisterCheckout) {
        this.checkout = checkout;
    }

    isEnabled() {
        if (!this.checkout.singleOrganization?.meta.recordsConfiguration.freeContribution) {
            return false;
        }

        if (this.checkout.asOrganizationId) {
            return false;
        }

        if (this.checkout.cart.items.length === 0) {
            // Just paying for outstanding balances
            return false;
        }

        if (this.checkout.totalPrice === 0) {
            return false;
        }

        if (this.checkout.cart.items.find(item => item.member.patchedMember.details.requiresFinancialSupport?.value === true)) {
            return false;
        }

        return true;
    }

    getComponent(navigation: ViewStepNavigation): ComponentWithProperties {
        return AsyncComponent(() => import('../FreeContributionView.vue'), {
            checkout: this.checkout,
            saveHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate);
            },
        });
    }
}
