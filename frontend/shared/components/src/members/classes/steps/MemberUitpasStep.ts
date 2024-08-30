import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { PermissionLevel } from "@stamhoofd/structures";
import { markRaw } from "vue";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditMemberUitpasBox from "../../components/edit/EditMemberUitpasBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";
import { MemberSharedStepOptions } from "./MemberSharedStepOptions";

export class MemberUitpasStep implements EditMemberStep {
    options: MemberSharedStepOptions

    constructor(options: MemberSharedStepOptions) {
        this.options = options
    }

    getName(_manager: MemberStepManager) {
        return 'UiTPAS';
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('uitpasNumber', {
            checkPermissions: manager.context.user ? {
                level: PermissionLevel.Write,
                user: manager.context.user
            } : undefined
        })) {
            return false;
        }

        if (this.options.outdatedTime) {
            if (details.reviewTimes.isOutdated("uitpasNumber", this.options.outdatedTime)) {
                return true;
            }
        } else {
            // Also ask if never answered the question
            if (details.uitpasNumber === null && !details.reviewTimes.isReviewed("uitpasNumber")) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: 'UiTPAS',
            member: manager.member,
            component: markRaw(EditMemberUitpasBox),
            saveText: "Doorgaan",
            markReviewed: ['uitpasNumber'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
