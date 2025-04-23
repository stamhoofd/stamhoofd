import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { PermissionLevel } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import { MemberStepView } from '../..';
import { NavigationActions } from '../../../types/NavigationActions';
import EditMemberParentsBox from '../../components/edit/EditMemberParentsBox.vue';
import { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import { MemberSharedStepOptions } from './MemberSharedStepOptions';

export class MemberParentsStep implements EditMemberStep {
    options: MemberSharedStepOptions;

    constructor(options: MemberSharedStepOptions) {
        this.options = options;
    }

    getName(manager: MemberStepManager) {
        return $t(`Ouders`);
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member;
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('parents', {
            checkPermissions: manager.context.user
                ? {
                        level: PermissionLevel.Write,
                        user: manager.context.user,
                    }
                : undefined,
        })) {
            return false;
        }

        if (details.parents.length === 0 && member.isPropertyRequired('parents')) {
            return true;
        }

        if (member.isPropertyRequired('nationalRegisterNumber') && !details.parents.some(p => !!p.nationalRegisterNumber)) {
            return true;
        }

        // Check if it has been a while since this information was reviewed
        if (this.options.outdatedTime) {
            if (details.reviewTimes.isOutdated('parents', this.options.outdatedTime)) {
                return true;
            }
        }
        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: $t(`Ouders`),
            member: manager.member,
            component: markRaw(EditMemberParentsBox),
            saveText: $t(`Doorgaan`),
            markReviewed: ['parents'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
