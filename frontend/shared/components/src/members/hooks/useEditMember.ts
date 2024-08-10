import { ComponentWithProperties, usePresent } from "@simonbackx/vue-app-navigation";
import { PlatformMember } from "@stamhoofd/structures";
import { markRaw } from "vue";
import { EditMemberAllBox, MemberStepView } from "..";

export function useEditMember() {
    const present = usePresent();
    
    return async (member: PlatformMember, options: {title: string}) => {
        await present({
            components: [
                new ComponentWithProperties(MemberStepView, {
                    member,
                    title: options.title,
                    component: markRaw(EditMemberAllBox)
                })
            ],
            modalDisplayStyle: "popup"
        })    
    }
}
