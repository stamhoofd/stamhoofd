import { ComponentWithProperties, usePresent } from "@simonbackx/vue-app-navigation";
import { PlatformMember } from "@stamhoofd/structures";
import { markRaw } from "vue";
import { EditMemberAllBox, MemberStepView } from "..";
import { NavigationActions } from "../../types/NavigationActions";

export function useEditMember() {
    const present = usePresent();

    return (member: PlatformMember) => present({
        components: [
            new ComponentWithProperties(MemberStepView, {
                member: member,
                title: member.member.firstName + ' ' + $t(`ee3bc635-c294-4134-9155-7a74f47dec4f`),
                component: markRaw(EditMemberAllBox),
                saveHandler: async ({dismiss}: NavigationActions) => {
                    await dismiss({force: true});
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}
