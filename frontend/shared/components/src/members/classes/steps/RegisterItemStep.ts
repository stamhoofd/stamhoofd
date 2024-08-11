import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { RegisterItem } from "@stamhoofd/structures";
import { NavigationActions } from "../../../types/NavigationActions";
import RegisterItemView from "../../RegisterItemView.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";

export class RegisterItemStep implements EditMemberStep {
    item: RegisterItem
    showGroupInformation: boolean

    constructor(item: RegisterItem, options?: {showGroupInformation?: boolean}) {
        this.item = item
        this.showGroupInformation = options?.showGroupInformation ?? false
    }

    getName(manager: MemberStepManager) {
        return this.item.group.settings.name
    }

    isEnabled(_manager: MemberStepManager) {
        return this.item.showItemView || this.showGroupInformation
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(RegisterItemView, {
            showGroupInformation: this.showGroupInformation,
            member: manager.member,
            item: this.item.clone(),
            saveHandler: async (item: RegisterItem, navigate: NavigationActions) => {
                this.item.copyFrom(item)
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
