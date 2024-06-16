import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditEmergencyContactsBox from "../../components/edit/EditEmergencyContactsBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";
import { markRaw } from "vue";

const outdatedTime = 60*1000*60*24*31*3 // 3 months

export const MemberEmergencyContactsStep: EditMemberStep = {
    isEnabled(manager: MemberStepManager) {
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('emergencyContacts')) {
            return false;
        }

        if (details.emergencyContacts.length === 0 && member.isPropertyRequired('emergencyContacts')) {
            return true;
        }

        if (details.reviewTimes.isOutdated("emergencyContacts", outdatedTime)) {
            return true;
        }

        return false;
    },
    getComponent: function (manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: 'Noodcontactpersonen',
            member: manager.member,
            component: markRaw(EditEmergencyContactsBox),
            saveText: "Doorgaan",
            markReviewed: ['emergencyContacts'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
