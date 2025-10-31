import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { PlatformMember } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import { EditMemberAllBox, MemberStepView } from '..';
import { NavigationActions } from '../../types/NavigationActions';
import { AppManager } from '@stamhoofd/networking';
import { useContext } from '../../hooks';

export function useEditMember() {
    const present = usePresent();
    const context = useContext();

    return (member: PlatformMember) => present({
        components: [
            new ComponentWithProperties(MemberStepView, {
                member: member,
                title: $t(`8748130b-9551-4ad4-b80e-9fd1119651a7`, { firstName: member.member.firstName }),
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
