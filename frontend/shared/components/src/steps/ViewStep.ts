import { type ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { type ViewStepsManager } from './ViewStepsManager';

export interface ViewStep {
    getComponent(manager: ViewStepsManager): Promise<ComponentWithProperties> | ComponentWithProperties;
    isEnabled(manager: ViewStepsManager): boolean;
}
