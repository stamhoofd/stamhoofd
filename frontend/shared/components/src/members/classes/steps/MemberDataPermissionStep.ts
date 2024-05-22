import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { DataPermissionsSettings } from "@stamhoofd/structures";
import { markRaw } from "vue";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditMemberDataPermissionsBox from "../../components/edit/EditMemberDataPermissionsBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";

const outdatedTime = 60*1000*60*24 // 1 day

export const MemberDataPermissionStep: EditMemberStep = {
    isEnabled(manager: MemberStepManager) {
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('dataPermission')) {
            return false;
        }

        if (details.dataPermissions === null || (details.dataPermissions.value === false && details.dataPermissions.isOutdated(outdatedTime))) {
            return true;
        }

        return false;
    },
    getComponent: function (manager: MemberStepManager): ComponentWithProperties {
        const config = manager.member.platform.config.recordsConfiguration.dataPermission ?? manager.member.organizations.find(o => o.meta.recordsConfiguration.dataPermission)?.meta.recordsConfiguration.dataPermission ?? null
        return new ComponentWithProperties(MemberStepView, {
            title: config?.title ?? DataPermissionsSettings.defaultTitle,
            member: manager.member,
            component: markRaw(EditMemberDataPermissionsBox),
            saveText: "Doorgaan",
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
