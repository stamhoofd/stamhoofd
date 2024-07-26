import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { RecordCategory, RegisterItem } from "@stamhoofd/structures";
import { markRaw } from "vue";
import { MemberStepView } from "../..";
import { NavigationActions } from "../../../types/NavigationActions";
import EditMemberRecordCategoryBox from "../../components/edit/EditMemberRecordCategoryBox.vue";
import { EditMemberStep, MemberStepManager } from "../MemberStepManager";

const outdatedTime = 60*1000*60*24*31*3 // 3 months

export class MemberRecordCategoryStep implements EditMemberStep {
    recordCategory: RecordCategory
    item: RegisterItem

    constructor(recordCategory: RecordCategory, item: RegisterItem) {
        this.recordCategory = recordCategory
        this.item = item
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member
        const enabledCategories = member.getEnabledRecordCategories({ 
            scopeOrganization: this.item.organization,
            scopeGroup: this.item.group,   
        })

        const enabled = !!enabledCategories.find(c => c.id == this.recordCategory.id);

        if (!enabled) {
            return false;
        }

        // check if everything has been answered already + check out of date
        const records = this.recordCategory.getAllFilteredRecords(member)

        // Check all the properties in this category and check their last review times
        for (const record of records) {
            const answer = member.patchedMember.details.recordAnswers.get(record.id)
            if (!answer) {
                // This was never answered
                return true
            }

            if (answer.isOutdated(outdatedTime)) {
                // This answer is outdated
                return true
            }

            try {
                answer.validate()
            } catch (e) {
                // This answer is not valid anymore
                return true
            }
        }

        // We got all the answers, and they are all very recent
        return false
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        return new ComponentWithProperties(MemberStepView, {
            title: this.recordCategory.name,
            member: manager.member,
            component: markRaw(EditMemberRecordCategoryBox),
            saveText: "Doorgaan",
            category: this.recordCategory,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate)
            }
        })
    }
}
