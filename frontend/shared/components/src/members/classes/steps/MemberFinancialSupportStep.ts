import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { FinancialSupportSettings, PermissionLevel } from "@stamhoofd/structures";
import { DataValidator } from "@stamhoofd/utility";
import { markRaw } from "vue";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditMemberFinancialSupportBox from "../../components/edit/EditMemberFinancialSupportBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";
import { MemberSharedStepOptions } from "./MemberSharedStepOptions";

export class MemberFinancialSupportStep implements EditMemberStep {
    options: MemberSharedStepOptions

    constructor(options: MemberSharedStepOptions) {
        this.options = options
    }

    getName(manager: MemberStepManager) {
        const recordsConfigurations = manager.member.filterRecordsConfigurations({currentPeriod: true})

        for (const config of recordsConfigurations) {
            if (config.financialSupport?.title) {
                return config.financialSupport.title
            }
        }

        return FinancialSupportSettings.defaultTitle
    }

    isEnabled(manager: MemberStepManager) {    
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('financialSupport', {
            checkPermissions: manager.context.user ? {
                level: PermissionLevel.Write,
                user: manager.context.user
            } : undefined
        })) {
            return false;
        }
        
        if(details.uitpasNumber !== null) {
            // if uitpas number is 'kansentarief' this step can be skipped
            if(DataValidator.isUitpasNumberKansenTarief(details.uitpasNumber)) {
                return false;
            }
        }

        if (details.requiresFinancialSupport === null) {
            return true;
        }

        if (this.options.outdatedTime) {
            if (details.requiresFinancialSupport.value === false && details.requiresFinancialSupport.isOutdated(this.options.outdatedTime)) {
                return true;
            }
        }

        return false;
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        const config = manager.member.platform.config.recordsConfiguration.financialSupport ?? manager.member.organizations.find(o => o.meta.recordsConfiguration.financialSupport)?.meta.recordsConfiguration.financialSupport ?? null
        return new ComponentWithProperties(MemberStepView, {
            title: config?.title ?? FinancialSupportSettings.defaultTitle,
            member: manager.member,
            component: markRaw(EditMemberFinancialSupportBox),
            saveText: "Doorgaan",
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
