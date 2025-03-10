import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { PlatformFamily, PlatformMember } from '@stamhoofd/structures';
import { markRaw, reactive } from 'vue';
import { EditMemberGeneralBox, MemberStepView } from '..';
import { DisplayOptions, NavigationActions, runDisplayOptions, useNavigationActions } from '../../types/NavigationActions';
import { useAppContext } from '../../context';

export function useAddMember() {
    const navigate = useNavigationActions();

    return async (family: PlatformFamily, options: { displayOptions: DisplayOptions; finishHandler: (member: PlatformMember, navigate: NavigationActions) => Promise<void> | void }) => {
        // We clone the family, so we can cancel the new member that was added to the family
        const clonedFamily = family.clone();
        const member = reactive(clonedFamily.newMember() as any) as PlatformMember;
        const app = useAppContext();

        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberStepView, {
                title: 'Nieuw lid inschrijven',
                member,
                component: markRaw(EditMemberGeneralBox),
                saveHandler: async (navigate: NavigationActions) => {
                    // Copy the changes to the original family
                    family.copyFromClone(clonedFamily);

                    // Find the member
                    // The reference to the member could have changed - we need to make sure we have a reference to a member in the original family
                    const realMember = family.members.find(m => m.id == clonedFamily.members[clonedFamily.members.length - 1].id);
                    if (!realMember) {
                        await navigate.dismiss({ force: true });
                        return;
                    }

                    if (app === 'registration' && realMember.filterRegistrations({ currentPeriod: true }).length) {
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
