import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { PermissionLevel, UitpasSocialTariffStatus } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import { MemberStepView } from '../..';
import { NavigationActions } from '../../../types/NavigationActions';
import EditMemberUitpasBox from '../../components/edit/EditMemberUitpasBox.vue';
import { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import { MemberSharedStepOptions } from './MemberSharedStepOptions';

export class MemberUitpasStep implements EditMemberStep {
    options: MemberSharedStepOptions;

    constructor(options: MemberSharedStepOptions) {
        this.options = options;
    }

    getName(_manager: MemberStepManager) {
        return $t(`612b0f89-4a6e-4616-a50f-6e228daa86c3`);
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member;
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('uitpasNumber', {
            checkPermissions: manager.context.user
                ? {
                        level: PermissionLevel.Write,
                        user: manager.context.user,
                    }
                : undefined,
        })) {
            return false;
        }

        // The step should be shown if the status of the uitpas social tariff is unknown
        if (details.uitpasNumberDetails !== null && details.uitpasNumberDetails.socialTariff.status === UitpasSocialTariffStatus.Unknown) {
            return true;
        }

        if (this.options.outdatedTime) {
            if (details.reviewTimes.isOutdated('uitpasNumber', this.options.outdatedTime)) {
                return true;
            }
        }
        else {
            // Also ask if never answered the question
            if (details.uitpasNumberDetails === null && !details.reviewTimes.isReviewed('uitpasNumber')) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: $t(`612b0f89-4a6e-4616-a50f-6e228daa86c3`),
            member: manager.member,
            component: markRaw(EditMemberUitpasBox),
            saveText: $t(`c72a9ab2-98a0-4176-ba9b-86fe009fa755`),
            markReviewed: ['uitpasNumber'],
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
