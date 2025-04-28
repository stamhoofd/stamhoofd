import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { RecordCategory, RegisterItem } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import { MemberStepView } from '../..';
import { NavigationActions } from '../../../types/NavigationActions';
import EditMemberRecordCategoryBox from '../../components/edit/EditMemberRecordCategoryBox.vue';
import { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import { MemberSharedStepOptions } from './MemberSharedStepOptions';

export class MemberRecordCategoryStep implements EditMemberStep {
    recordCategory: RecordCategory;
    item: RegisterItem | null;
    options: MemberSharedStepOptions;

    constructor(recordCategory: RecordCategory, item: RegisterItem | null, options: MemberSharedStepOptions) {
        this.recordCategory = recordCategory;
        this.item = item;
        this.options = options;
    }

    getName(manager: MemberStepManager) {
        return this.recordCategory.name.toString();
    }

    isEnabled(manager: MemberStepManager) {
        const member = manager.member;
        const enabledCategories = member.getEnabledRecordCategories({
            scopeOrganization: this.item?.organization,
            scopeGroup: this.item?.group,
        });

        const enabled = !!enabledCategories.find(c => c.id === this.recordCategory.id);

        if (!enabled) {
            return false;
        }

        // check if everything has been answered already + check out of date
        return !this.recordCategory.isComplete(member, this.options.outdatedTime);
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        // The record category filters can get adjusted due to inheritance. That is why we need to proplery load them
        const member = manager.member;
        const enabledCategories = member.getEnabledRecordCategories({
            scopeOrganization: this.item?.organization,
            scopeGroup: this.item?.group,
        });

        const recordCategory = enabledCategories.find(c => c.id === this.recordCategory.id) ?? this.recordCategory;

        return new ComponentWithProperties(MemberStepView, {
            title: recordCategory.name,
            member: manager.member,
            component: markRaw(EditMemberRecordCategoryBox),
            saveText: $t(`c72a9ab2-98a0-4176-ba9b-86fe009fa755`),
            category: recordCategory,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
