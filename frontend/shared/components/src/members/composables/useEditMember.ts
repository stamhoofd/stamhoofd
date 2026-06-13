import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import type { PlatformMember } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import EditMemberAllBox from '#members/components/edit/EditMemberAllBox.vue';
import MemberStepView from '#members/MemberStepView.vue';
import type { NavigationActions } from '../../types/NavigationActions';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { useContext } from '#hooks/useContext.ts';

export function useEditMember() {
    const present = usePresent();
    const context = useContext();

    return (member: PlatformMember) => present({
        components: [
            new ComponentWithProperties(MemberStepView, {
                member: member,
                title: $t(`%15E`, { firstName: member.member.firstName }),
                component: markRaw(EditMemberAllBox),
                saveHandler: async ({ dismiss }: NavigationActions) => {
                    await dismiss({ force: true });

                    // Mark review moment
                    AppManager.shared.markReviewMoment(context.value);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
