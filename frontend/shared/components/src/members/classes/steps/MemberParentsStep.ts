import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditMemberParentsBox from "../../components/edit/EditMemberParentsBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";
import { markRaw } from "vue";

const outdatedTime = 60*1000*60*24*31*3 // 3 months

export const MemberParentsStep: EditMemberStep = {
    isEnabled(manager: MemberStepManager) {
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('parents')) {
            return false;
        }

        if (details.parents.length === 0 && member.isPropertyRequired('parents')) {
            return true;
        }

        if (details.reviewTimes.isOutdated("parents", outdatedTime)) {
            return true;
        }

        return false;
    },
    getComponent: function (manager: MemberStepManager): ComponentWithProperties {
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
