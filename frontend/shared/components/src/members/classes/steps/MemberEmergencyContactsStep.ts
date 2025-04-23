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
        return $t(`36756394-4c8d-4b0d-bc88-9fe1d58caf1d`)
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
            title: $t(`36756394-4c8d-4b0d-bc88-9fe1d58caf1d`),
            member: manager.member,
            component: markRaw(EditEmergencyContactsBox),
            saveText: $t(`c72a9ab2-98a0-4176-ba9b-86fe009fa755`),
            markReviewed: ['emergencyContacts'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
