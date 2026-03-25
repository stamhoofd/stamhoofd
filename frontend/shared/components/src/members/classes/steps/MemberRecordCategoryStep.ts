import MemberStepView from '#members/MemberStepView.vue';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type { RecordCategory, RegisterItem } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/structures';
import { markRaw } from 'vue';
import type { NavigationActions } from '../../../types/NavigationActions';
import EditMemberRecordCategoryBox from '../../components/edit/EditMemberRecordCategoryBox.vue';
import type { EditMemberStep, MemberStepManager } from '../MemberStepManager';
import type { MemberSharedStepOptions } from './MemberSharedStepOptions';

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
        const { categories: enabledCategories } = member.getEnabledRecordCategories({
            scopeOrganization: this.item?.organization,
            scopeGroup: this.item?.group,
        });

        const enabled = !!enabledCategories.find(c => c.id === this.recordCategory.id);

        if (!enabled) {
            return false;
        }

        // check if everything has been answered already + check out of date
        return !this.recordCategory.isComplete(member, this.options.outdatedTime, {
            level: PermissionLevel.Write, // Only show records where user managers have write access to
        });
    }

    getComponent(manager: MemberStepManager): ComponentWithProperties {
        // The record category filters can get adjusted due to inheritance. That is why we need to proplery load them
        const member = manager.member;
        const { categories: enabledCategories } = member.getEnabledRecordCategories({
            scopeOrganization: this.item?.organization,
            scopeGroup: this.item?.group,
        });

        const recordCategory = enabledCategories.find(c => c.id === this.recordCategory.id) ?? this.recordCategory;

        return new ComponentWithProperties(MemberStepView, {
            title: recordCategory.name,
            member: manager.member,
            component: markRaw(EditMemberRecordCategoryBox),
            saveText: $t(`%16p`),
            category: recordCategory,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }
}
