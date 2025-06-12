import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { RegisterItem } from '@stamhoofd/structures';
import { NavigationActions } from '../../../types/NavigationActions';
import RegisterItemView from '../../RegisterItemView.vue';
import { EditMemberStep, MemberStepManager } from '../MemberStepManager';

export class RegisterItemStep implements EditMemberStep {
    item: RegisterItem;

    /**
     * Indicates whether the checkout flow will start immediately after adding this item to the cart.
     * When this is used, the full cart price breakdown will be displayed in the view (because we won't navigate to the cart after adding the item).
     */
    willStartCheckoutFlow = false;

    constructor(item: RegisterItem, options?: { willStartCheckoutFlow }) {
        this.item = item;
        this.willStartCheckoutFlow = options?.willStartCheckoutFlow ?? false;
    }

    getName(manager: MemberStepManager) {
        return this.item.group.settings.name.toString();
    }

    isEnabled(_manager: MemberStepManager) {
        return true;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(RegisterItemView, {
            member: manager.member,
            item: this.item.clone(),
            willStartCheckoutFlow: this.willStartCheckoutFlow,
            saveHandler: async (item: RegisterItem, navigate: NavigationActions) => {
                this.item.copyFrom(item);
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
