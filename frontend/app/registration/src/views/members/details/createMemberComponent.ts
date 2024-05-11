import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import { MemberManager } from "../../../classes/MemberManager";
import { BuiltInEditMemberStep, EditMemberStepsManager, EditMemberStepType } from "./EditMemberStepsManager";

export async function createMemberComponent($memberManager: MemberManager) {
    const stepManager = new EditMemberStepsManager(
        $memberManager,
        [
            new BuiltInEditMemberStep($memberManager.$context, EditMemberStepType.Details, true, false)
        ], 
        [],
        undefined,
        async (component: NavigationMixin) => {
            // when we are ready, show the 'choose group' view for this member
            if (stepManager.editMember) {
                const MemberChooseGroupsView = (await import(/* webpackChunkName: "MemberChooseGroupsView", webpackPrefetch: true */ '../MemberChooseGroupsView.vue')).default;

                component.show({
                    components: [
                        new ComponentWithProperties(MemberChooseGroupsView, {
                            member: stepManager.editMember 
                        })
                    ],
                    replace: component.navigationController?.components.length ?? 1,
                    force: true
                })
            } else {
                // uhm?
                // default to dismiss
                console.error("Missing edit member at the end of edit member flow")
                component.dismiss({ force: true })
            }
            return Promise.resolve()
        }
    )
    return await stepManager.getFirstComponent()
}
