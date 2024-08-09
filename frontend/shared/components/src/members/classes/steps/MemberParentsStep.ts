import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditMemberParentsBox from "../../components/edit/EditMemberParentsBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";
import { markRaw } from "vue";
import { PermissionLevel } from "@stamhoofd/structures";
import { MemberSharedStepOptions } from "./MemberSharedStepOptions";

export class MemberParentsStep implements EditMemberStep {
    options: MemberSharedStepOptions

    constructor(options: MemberSharedStepOptions) {
        this.options = options
    }

    getName(manager: MemberStepManager) {
        return 'Ouders'
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('parents', {
            checkPermissions: manager.context.user ? {
                level: PermissionLevel.Write,
                user: manager.context.user
            } : undefined
        })) {
            return false;
        }

        if (details.parents.length === 0 && member.isPropertyRequired('parents')) {
            return true;
        }


        // Check if it has been a while since this information was reviewed
        if (this.options.outdatedTime) {
            if (details.reviewTimes.isOutdated("parents", this.options.outdatedTime)) {
                return true;
            }
        }
        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: 'Ouders',
            member: manager.member,
            component: markRaw(EditMemberParentsBox),
            saveText: "Doorgaan",
            markReviewed: ['parents'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
