import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { RegisterItem } from "@stamhoofd/structures";
import { NavigationActions } from "../../../types/NavigationActions";
import RegisterItemView from "../../RegisterItemView.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";

export class RegisterItemStep implements EditMemberStep {
    item: RegisterItem
    admin: boolean
    showGroupInformation: boolean

    constructor(item: RegisterItem, options?: {admin?: boolean, showGroupInformation?: boolean}) {
        this.item = item
        this.admin = options?.admin ?? false
        this.showGroupInformation = options?.showGroupInformation ?? false
    }

    isEnabled(_manager: MemberStepManager) {
        return this.item.showItemView || this.showGroupInformation
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(RegisterItemView, {
            showGroupInformation: this.showGroupInformation,
            member: manager.member,
            item: this.item.clone(),
            admin: this.admin,
            saveHandler: async (item: RegisterItem, navigate: NavigationActions) => {
                this.item.copyFrom(item)
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
