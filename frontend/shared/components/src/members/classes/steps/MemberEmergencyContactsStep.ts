import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import MemberStepView from '#members/MemberStepView.vue';
import type { NavigationActions } from '../../../types/NavigationActions';
import EditEmergencyContactsBox from '../../components/edit/EditEmergencyContactsBox.vue';
import type { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import { markRaw } from 'vue';
import { PermissionLevel } from '@stamhoofd/structures';
import type { MemberSharedStepOptions } from './MemberSharedStepOptions';

export class MemberEmergencyContactsStep implements EditMemberStep {
    options: MemberSharedStepOptions

    constructor(options: MemberSharedStepOptions) {
        this.options = options
    }

    getName(manager: MemberStepManager) {
        return $t(`%f1`)
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
            if (details.reviewTimes.isOutdated('emergencyContacts', this.options.outdatedTime)) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: $t(`%f1`),
            member: manager.member,
            component: markRaw(EditEmergencyContactsBox),
            saveText: $t(`%16p`),
            markReviewed: ['emergencyContacts'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
