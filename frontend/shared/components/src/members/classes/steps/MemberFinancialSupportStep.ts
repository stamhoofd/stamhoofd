import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { FinancialSupportSettings, PermissionLevel } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import { MemberStepView } from '../..';
import { NavigationActions } from '../../../types/NavigationActions';
import EditMemberFinancialSupportBox from '../../components/edit/EditMemberFinancialSupportBox.vue';
import { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import { MemberSharedStepOptions } from './MemberSharedStepOptions';

export class MemberFinancialSupportStep implements EditMemberStep {
    options: MemberSharedStepOptions;

    constructor(options: MemberSharedStepOptions) {
        this.options = options;
    }

    getName(manager: MemberStepManager) {
        const settings = manager.member.platform.config.financialSupport ?? FinancialSupportSettings.create({});
        return settings.title;
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
        if (details.uitpasNumberDetails && details.uitpasNumberDetails.socialTariff.isActive) {
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
            title: manager.member.platform.config.financialSupport?.title ?? FinancialSupportSettings.defaultTitle,
            member: manager.member,
            component: markRaw(EditMemberFinancialSupportBox),
            saveText: $t(`c72a9ab2-98a0-4176-ba9b-86fe009fa755`),
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
