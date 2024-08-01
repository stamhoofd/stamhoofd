import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { RegisterCheckout } from "@stamhoofd/structures";
import { NavigationActions } from "../../../types/NavigationActions";
import FreeContributionView from "../FreeContributionView.vue";
import { ViewStep, ViewStepsManager } from "../../classes/ViewStepsManager";
import PaymentSelectionView from "../PaymentSelectionView.vue";


export class PaymentSelectionStep implements ViewStep {
    checkout: RegisterCheckout

    constructor(checkout: RegisterCheckout) {
        this.checkout = checkout
    }

    isEnabled(_manager: ViewStepsManager) {
        if (this.checkout.isAdminFromSameOrganization) {
            return false;
        }

        return true;
    }

    getComponent(manager: ViewStepsManager): ComponentWithProperties {
        return new ComponentWithProperties(PaymentSelectionView, {
            checkout: this.checkout,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
