import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { EditMemberGeneralBox, MemberStepView } from '../..';
import { NavigationActions } from '../../../types/NavigationActions';
import { MemberStepManager } from '../MemberStepManager';
import { EditMemberStep } from '../MemberStepManager';
import { markRaw } from 'vue';
import { MemberSharedStepOptions } from './MemberSharedStepOptions';
import { PermissionLevel } from '@stamhoofd/structures';

export class MemberGeneralStep implements EditMemberStep {
    options: MemberSharedStepOptions;

    constructor(options: MemberSharedStepOptions) {
        this.options = options;
    }

    getName(manager: MemberStepManager) {
        return $t(`67254c38-5652-4daf-a412-b6e835c403bd`);
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
            title: $t(`67254c38-5652-4daf-a412-b6e835c403bd`),
            member: manager.member,
            component: markRaw(EditMemberGeneralBox),
            saveText: $t(`c72a9ab2-98a0-4176-ba9b-86fe009fa755`),
            markReviewed: ['details'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
