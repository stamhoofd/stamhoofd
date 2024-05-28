import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { FinancialSupportSettings } from "@stamhoofd/structures";
import { markRaw } from "vue";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditMemberFinancialSupportBox from "../../components/edit/EditMemberFinancialSupportBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";

const outdatedTime = 60*1000*60*24*365/2 // half year

export const MemberFinancialSupportStep: EditMemberStep = {
    isEnabled(manager: MemberStepManager) {
        const member = manager.member
        const details = member.patchedMember.details;

        if (!member.isPropertyEnabled('financialSupport')) {
            return false;
        }

        if (details.requiresFinancialSupport === null || (details.requiresFinancialSupport.value === false && details.requiresFinancialSupport.isOutdated(outdatedTime))) {
            return true;
        }

        return false;
    },
    getComponent: function (manager: MemberStepManager): ComponentWithProperties {
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
