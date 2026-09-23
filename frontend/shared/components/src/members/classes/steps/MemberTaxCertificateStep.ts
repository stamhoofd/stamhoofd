import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { PermissionLevel } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import type { NavigationActions } from '../../../types/NavigationActions';
import EditMemberUitpasBox from '../../components/edit/EditMemberUitpasBox.vue';
import type { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import type { MemberSharedStepOptions } from './MemberSharedStepOptions';
import EditMemberTaxCertificateBox from '#members/components/edit/EditMemberTaxCertificateBox.vue';

export class MemberTaxCertificateStep implements EditMemberStep {
    options: MemberSharedStepOptions;

    constructor(options: MemberSharedStepOptions) {
        this.options = options;
    }

    getName(_manager: MemberStepManager) {
        return $t(`Fiscale attesten`);
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member;
        const details = member.patchedMember.details;

        if (!member.patchedMember.details.parents.length) {
            return false;
        }

        if (!member.isPropertyEnabled('taxCertificates', {
            checkPermissions: manager.context.user
                ? {
                        level: PermissionLevel.Write,
                        user: manager.context.user,
                    }
                : undefined,
        })) {
            return false;
        }

        if (this.options.outdatedTime) {
            if (details.reviewTimes.isOutdated('taxCertificates', this.options.outdatedTime)) {
                return true;
            }
        }

        if (!member.hasRequiredParentNationalRegisterNumbers || !member.patchedMember.details.nationalRegisterNumber) {
            return true;
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return AsyncComponent(() => import('#members/MemberStepView.vue'), {
            title: $t(`Fiscale attesten`),
            member: manager.member,
            component: markRaw(EditMemberTaxCertificateBox),
            saveText: $t(`%16p`),
            markReviewed: ['taxCertificates'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
