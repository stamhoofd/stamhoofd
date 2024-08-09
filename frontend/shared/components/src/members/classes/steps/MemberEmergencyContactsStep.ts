import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditEmergencyContactsBox from "../../components/edit/EditEmergencyContactsBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";
import { markRaw } from "vue";
import { PermissionLevel } from "@stamhoofd/structures";
import { MemberSharedStepOptions } from "./MemberSharedStepOptions";

export class MemberEmergencyContactsStep implements EditMemberStep {
    options: MemberSharedStepOptions

    constructor(options: MemberSharedStepOptions) {
        this.options = options
    }

    getName(manager: MemberStepManager) {
        return 'Noodcontactpersonen'
    }

    isEnabled(manager: MemberStepManager) {    
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('emergencyContacts', {
            checkPermissions: manager.context.user ? {
                level: PermissionLevel.Write,
                user: manager.context.user
            } : undefined
        })) {
            return false;
        }

        if (details.emergencyContacts.length === 0 && member.isPropertyRequired('emergencyContacts')) {
            return true;
        }

        if (this.options.outdatedTime) {
            if (details.reviewTimes.isOutdated("emergencyContacts", this.options.outdatedTime)) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
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
