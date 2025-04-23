import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { DataPermissionsSettings, PermissionLevel } from "@stamhoofd/structures";
import { markRaw } from "vue";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditMemberDataPermissionsBox from "../../components/edit/EditMemberDataPermissionsBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";
import { MemberSharedStepOptions } from "./MemberSharedStepOptions";

const maxOutdatedTime = 60*1000*60*24 // 1 day

export class MemberDataPermissionStep implements EditMemberStep {
    options: MemberSharedStepOptions

    constructor(options: MemberSharedStepOptions) {
        this.options = options
    }

    getName(manager: MemberStepManager) {
        const settings = manager.member.platform.config.dataPermission ?? DataPermissionsSettings.create({})
        return settings.title
    }

    isEnabled(manager: MemberStepManager) {    
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('dataPermission', {
            checkPermissions: manager.context.user ? {
                level: PermissionLevel.Write,
                user: manager.context.user
            } : undefined
        })) {
            return false;
        }

        if (details.dataPermissions === null) {
            return true;
        }

        if (this.options.outdatedTime) {
            if (details.dataPermissions.value === false && details.dataPermissions.isOutdated(Math.min(this.options.outdatedTime, maxOutdatedTime))) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        const config = manager.member.platform.config.recordsConfiguration.dataPermission ?? manager.member.organizations.find(o => o.meta.recordsConfiguration.dataPermission)?.meta.recordsConfiguration.dataPermission ?? null
        return new ComponentWithProperties(MemberStepView, {
            title: config?.title ?? DataPermissionsSettings.defaultTitle,
            member: manager.member,
            component: markRaw(EditMemberDataPermissionsBox),
            saveText: $t(`c72a9ab2-98a0-4176-ba9b-86fe009fa755`),
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
