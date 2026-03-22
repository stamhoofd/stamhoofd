import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import type {ViewStepsManager} from '#steps/ViewStepsManager.ts';
import type {ViewStep} from '#steps/ViewStep.ts';
import type { EventNotificationViewModel } from '../classes/EventNotificationViewModel';
import EditEventNotificationGeneralView from '../EditEventNotificationGeneralView.vue';
import type { NavigationActions } from '../../types/NavigationActions';

export class GeneralStep implements ViewStep {
    viewModel: EventNotificationViewModel;

    constructor(viewModel: EventNotificationViewModel) {
        this.viewModel = viewModel;
    }

    getComponent(manager: ViewStepsManager): Promise<ComponentWithProperties> | ComponentWithProperties {
        return new ComponentWithProperties(EditEventNotificationGeneralView, {
            viewModel: this.viewModel,
            saveHandler: async (navigate: NavigationActions) => {
                await manager.saveHandler(this, navigate);
            },
        });
    }

    isEnabled(manager: ViewStepsManager): boolean {
        // For now only enabled for new ones
        return this.viewModel.isNew;
    }
}
