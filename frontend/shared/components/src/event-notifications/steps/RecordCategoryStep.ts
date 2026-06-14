import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { RecordCategory } from '@stamhoofd/structures';
import type {ViewStepsManager} from '#steps/ViewStepsManager.ts';
import type {ViewStep} from '#steps/ViewStep.ts';
import type { EventNotificationViewModel } from '../classes/EventNotificationViewModel';

import type { NavigationActions } from '../../types/NavigationActions';

export class RecordCategoryStep implements ViewStep {
    viewModel: EventNotificationViewModel;
    recordCategory: RecordCategory;

    constructor(viewModel: EventNotificationViewModel, recordCategory: RecordCategory) {
        this.viewModel = viewModel;
        this.recordCategory = recordCategory;
    }

    getComponent(manager: ViewStepsManager): Promise<ComponentWithProperties> | ComponentWithProperties {
        return AsyncComponent(() => import('../EditEventNotificationRecordCategoryView.vue'), {
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
