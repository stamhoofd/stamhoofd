import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type {ViewStep, ViewStepNavigation} from '#steps/ViewStep.ts';
import type { EventNotificationViewModel } from '../classes/EventNotificationViewModel';

import type { NavigationActions } from '../../types/NavigationActions';

export class GeneralStep implements ViewStep {
    viewModel: EventNotificationViewModel;

    constructor(viewModel: EventNotificationViewModel) {
        this.viewModel = viewModel;
    }

    getComponent(navigation: ViewStepNavigation): Promise<ComponentWithProperties> | ComponentWithProperties {
        return AsyncComponent(() => import('../EditEventNotificationGeneralView.vue'), {
            viewModel: this.viewModel,
            saveHandler: async (navigate: NavigationActions) => {
                await navigation.saveHandler(this, navigate);
            },
        });
    }

    isEnabled(): boolean {
        // For now only enabled for new ones
        return this.viewModel.isNew;
    }
}
