import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { EditMemberGeneralBox, MemberStepView } from '../..';
import type { NavigationActions } from '../../../types/NavigationActions';
import type { MemberStepManager } from '../MemberStepManager';
import type { EditMemberStep } from '../MemberStepManager';
import { markRaw } from 'vue';
import type { MemberSharedStepOptions } from './MemberSharedStepOptions';
import { PermissionLevel } from '@stamhoofd/structures';

export class MemberGeneralStep implements EditMemberStep {
    options: MemberSharedStepOptions;

    constructor(options: MemberSharedStepOptions) {
        this.options = options;
    }

    getName(manager: MemberStepManager) {
        return $t(`%f2`);
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member;
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

        if (!details.nationalRegisterNumber && member.isPropertyRequired('nationalRegisterNumber', {
            checkPermissions: manager.context.user
                ? {
                        level: PermissionLevel.Write,
                        user: manager.context.user,
                    }
                : undefined,
        })) {
            return true;
        }

        // Check if it has been a while since this information was reviewed
        if (this.options.outdatedTime) {
            if (details.reviewTimes.isOutdated('details', this.options.outdatedTime)) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: $t(`%f2`),
            member: manager.member,
            component: markRaw(EditMemberGeneralBox),
            saveText: $t(`%16p`),
            markReviewed: ['details'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
