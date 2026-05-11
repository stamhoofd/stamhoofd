import MemberStepView from '#members/MemberStepView.vue';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { getFinancialSupportSettingsOrDefault, PermissionLevel } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import type { NavigationActions } from '../../../types/NavigationActions';
import EditMemberFinancialSupportBox from '../../components/edit/EditMemberFinancialSupportBox.vue';
import type { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import type { MemberSharedStepOptions } from './MemberSharedStepOptions';

export class MemberFinancialSupportStep implements EditMemberStep {
    options: MemberSharedStepOptions;

    constructor(options: MemberSharedStepOptions) {
        this.options = options;
    }

    getName(manager: MemberStepManager) {
        // todo: test
        return getFinancialSupportSettingsOrDefault(manager.member.platform, manager.member.organizations[0]).title;
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member;
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('financialSupport', {
            checkPermissions: manager.context.user
                ? {
                        level: PermissionLevel.Write,
                        user: manager.context.user,
                    }
                : undefined,
        })) {
            return false;
        }

        // can be skipped if uitpas number is active
        if (details.uitpasNumberDetails && details.uitpasNumberDetails.isActive) {
            return false;
        }

        if (details.requiresFinancialSupport === null) {
            return true;
        }

        if (this.options.outdatedTime) {
            if (details.requiresFinancialSupport.value === false && details.requiresFinancialSupport.isOutdated(this.options.outdatedTime)) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: this.getName(manager),
            member: manager.member,
            component: markRaw(EditMemberFinancialSupportBox),
            saveText: $t(`%16p`),
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
