import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { PlatformMember } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import EditMemberAllBox from '#members/components/edit/EditMemberAllBox.vue';

import type { NavigationActions } from '../../types/NavigationActions';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { useContext } from '#hooks/useContext.ts';

export function useEditMember() {
    const present = usePresent();
    const context = useContext();

    return (member: PlatformMember) => present({
        components: [
            AsyncComponent(() => import('#members/MemberStepView.vue'), {
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
