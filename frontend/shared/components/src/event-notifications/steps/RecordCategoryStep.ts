import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { RecordCategory } from '@stamhoofd/structures';
import { type ViewStepsManager } from '#steps/ViewStepsManager';
import { type ViewStep } from '#steps/ViewStep';
import { EventNotificationViewModel } from '../classes/EventNotificationViewModel';
import EditEventNotificationRecordCategoryView from '../EditEventNotificationRecordCategoryView.vue';
import { NavigationActions } from '../../types/NavigationActions';

export class RecordCategoryStep implements ViewStep {
    viewModel: EventNotificationViewModel;
    recordCategory: RecordCategory;

    constructor(viewModel: EventNotificationViewModel, recordCategory: RecordCategory) {
        this.viewModel = viewModel;
        this.recordCategory = recordCategory;
    }

    getComponent(manager: ViewStepsManager): Promise<ComponentWithProperties> | ComponentWithProperties {
        return new ComponentWithProperties(EditEventNotificationRecordCategoryView, {
            viewModel: this.viewModel,
            category: this.recordCategory,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
            skipHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate, true);
            },
        });
    }

    isEnabled(manager: ViewStepsManager): boolean {
        // check if everything has been answered already + check out of date
        return this.recordCategory.isEnabled(this.viewModel.eventNotification);
    }
}
