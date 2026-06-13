import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import type { PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { markRaw, reactive } from 'vue';
import EditMemberGeneralBox from '#members/components/edit/EditMemberGeneralBox.vue';
import MemberStepView from '#members/MemberStepView.vue';
import { useAppContext } from '#context/appContext.ts';
import type { DisplayOptions, NavigationActions } from '../../types/NavigationActions';
import { runDisplayOptions, useNavigationActions } from '../../types/NavigationActions';
import { useOrganization } from '#hooks/useOrganization.ts';

export function useAddMember() {
    const navigate = useNavigationActions();
    const app = useAppContext();
    const organization = useOrganization();

    return async (family: PlatformFamily, options: {
        displayOptions: DisplayOptions;
        finishHandler: (member: PlatformMember, navigate: NavigationActions) => Promise<void> | void;
    }) => {
        // We clone the family, so we can cancel the new member that was added to the family
        const clonedFamily = family.clone();
        const member = reactive(clonedFamily.newMember() as any) as PlatformMember;

        if (STAMHOOFD.userMode === 'organization') {
            if (!organization.value) {
                throw new Error('Missing organization context');
            }
            member.member.organizationId = organization.value.id;
        }

        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberStepView, {
                title: $t(`%g5`),
                saveText: $t('%16p'),
                member,
                component: markRaw(EditMemberGeneralBox),
                saveHandler: async (navigate: NavigationActions) => {
                    // Copy the changes to the original family
                    family.copyFromClone(clonedFamily);

                    // Find the member
                    // The reference to the member could have changed - we need to make sure we have a reference to a member in the original family
                    const realMember = family.members.find(m => m.id === clonedFamily.members[clonedFamily.members.length - 1].id);
                    if (!realMember) {
                        await navigate.dismiss({ force: true });
                        return;
                    }

                    if (app === 'registration' && realMember.filterRegistrations({ currentPeriod: true }).length > 0) {
                        // This (new) member already has registrations. We don't need to show the choose group view.
                        await navigate.dismiss({ force: true });
                        return;
                    }

                    await options.finishHandler(realMember!, navigate);
                },
            }),
        });

        await runDisplayOptions({
            components: [
                component,
            ],
        }, options.displayOptions, navigate);
    };
}
