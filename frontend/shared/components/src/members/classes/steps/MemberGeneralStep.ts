import EditMemberGeneralBox from '../../components/edit/EditMemberGeneralBox.vue';

import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { PlatformMember } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import type { NavigationActions } from '../../../types/NavigationActions';
import type { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import type { MemberSharedStepOptions } from './MemberSharedStepOptions';

export function getMarkReviewedForGeneralStep(member: PlatformMember) {
    const details = member.patchedMember.details;

    // Check missing information
    if (!details.phone && member.isPropertyEnabled('phone')) {
        // Don't mark reviewed if data is missing
        return [];
    }

    if (!details.email && member.isPropertyEnabled('emailAddress')) {
        // Don't mark reviewed if data is missing
        return [];
    }

    if (!details.address && member.isPropertyEnabled('address')) {
        // Don't mark reviewed if data is missing
        return [];
    }

    if (!details.birthDay && member.isPropertyEnabled('birthDay')) {
        // Don't mark reviewed if data is missing
        return [];
    }

    if (!details.nationalRegisterNumber && member.isPropertyEnabled('nationalRegisterNumber')) {
        // Don't mark reviewed if data is missing
        return [];
    }

    return ['details'];
}

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
        return AsyncComponent(() => import('#members/MemberStepView.vue'), {
            title: $t(`%f2`),
            member: manager.member,
            component: markRaw(EditMemberGeneralBox),
            saveText: $t(`%16p`),
            getMarkReviewed: (member: PlatformMember) => getMarkReviewedForGeneralStep(member),
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
