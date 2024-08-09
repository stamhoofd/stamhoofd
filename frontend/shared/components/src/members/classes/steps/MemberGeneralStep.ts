import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { EditMemberGeneralBox, MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import { MemberStepManager } from "../MemberStepManager";
import { EditMemberStep } from "../MemberStepManager";
import { markRaw } from "vue";
import { MemberSharedStepOptions } from "./MemberSharedStepOptions";

export class MemberGeneralStep implements EditMemberStep {
    options: MemberSharedStepOptions

    constructor(options: MemberSharedStepOptions) {
        this.options = options
    }

    getName(manager: MemberStepManager) {
        return 'Algemene gegevens'
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member
        const details = member.patchedMember.details;

        // Check missing information
        if (!details.phone && member.isPropertyRequired('phone')) {
            return true;
        }

        if (!details.email && member.isPropertyRequired('emailAddress')) {
            return true;
        }

        if (!details.address && member.isPropertyRequired('address')) {
            return true;
        }

        if (!details.birthDay && member.isPropertyRequired('birthDay')) {
            return true;
        }

        // Check if it has been a while since this information was reviewed
        if (this.options.outdatedTime) {
            if (details.reviewTimes.isOutdated("details", this.options.outdatedTime)) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: 'Algemene gegevens',
            member: manager.member,
            component: markRaw(EditMemberGeneralBox),
            saveText: "Doorgaan",
            markReviewed: ['details'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
