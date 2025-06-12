import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { PlatformMember } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import { EditMemberAllBox, MemberStepView } from '..';
import { DisplayOptions, NavigationActions, runDisplayOptions, useNavigationActions } from '../../types/NavigationActions';

export function useEditMember() {
    const navigate = useNavigationActions();

    return async (member: PlatformMember, options: {
        title: string;
        saveText?: string;
        displayOptions?: DisplayOptions;
        navigate?: NavigationActions;
        finishHandler?: (navigate: NavigationActions) => Promise<void> | void;
    }) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberStepView, {
                member,
                title: options.title,
                saveText: options.saveText,
                component: markRaw(EditMemberAllBox),
                saveHandler: options.finishHandler,
            }),
        });

        await runDisplayOptions(
            {
                components: [
                    component,
                ],
            },
            options.displayOptions ?? { action: 'present', modalDisplayStyle: 'popup' },
            options.navigate ?? navigate,
        );
    };
}
