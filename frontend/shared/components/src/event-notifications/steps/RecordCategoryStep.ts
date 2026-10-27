import { ComponentWithProperties } from '@browser/navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { RecordCategory } from '@stamhoofd/structures';
import type {ViewStep, ViewStepNavigation} from '#steps/ViewStep.ts';
import type { EventNotificationViewModel } from '../classes/EventNotificationViewModel';

import type { NavigationActions } from '../../types/NavigationActions';

export class RecordCategoryStep implements ViewStep {
    viewModel: EventNotificationViewModel;
    recordCategory: RecordCategory;

    constructor(viewModel: EventNotificationViewModel, recordCategory: RecordCategory) {
        this.viewModel = viewModel;
        this.recordCategory = recordCategory;
    }

    getComponent(navigation: ViewStepNavigation): Promise<ComponentWithProperties> | ComponentWithProperties {
        return AsyncComponent(() => import('../EditEventNotificationRecordCategoryView.vue'), {
            viewModel: this.viewModel,
            category: this.recordCategory,
            saveHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate);
            },
            skipHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate, true);
            },
        });
    }

    isEnabled(): boolean {
        // check if everything has been answered already + check out of date
        return this.recordCategory.isEnabled(this.viewModel.eventNotification);
    }
}
