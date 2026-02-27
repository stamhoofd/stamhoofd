import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { RegisterCheckout } from '@stamhoofd/structures';
import { NavigationActions } from '../../../types/NavigationActions';
import FreeContributionView from '../FreeContributionView.vue';
import { type ViewStepsManager } from '#steps/ViewStepsManager';
import { type ViewStep } from '#steps/ViewStep';

export class FreeContributionStep implements ViewStep {
    checkout: RegisterCheckout;

    constructor(checkout: RegisterCheckout) {
        this.checkout = checkout;
    }

    isEnabled(_manager: ViewStepsManager) {
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

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(FreeContributionView, {
            checkout: this.checkout,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
