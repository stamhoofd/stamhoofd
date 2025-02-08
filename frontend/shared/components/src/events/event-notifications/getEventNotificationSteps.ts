import { ViewStep } from '../../members/classes/ViewStepsManager';
import { EventNotificationViewModel } from './classes/EventNotificationViewModel';
import { GeneralStep } from './steps/GeneralStep';
import { RecordCategoryStep } from './steps/RecordCategoryStep';

export function getEventNotificationSteps(viewModel: EventNotificationViewModel): ViewStep[] {
    return [
        new GeneralStep(viewModel),
        ...viewModel.type.recordCategories.map(category => new RecordCategoryStep(viewModel, category)),
    ];
}
