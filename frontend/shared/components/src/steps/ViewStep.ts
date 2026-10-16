import type {ComponentWithProperties} from '@simonbackx/vue-app-navigation';
import type { NavigationActions } from '../types/NavigationActions';

export interface ViewStepManager {
    saveHandler(currentStep: ViewStep | null, navigate: NavigationActions, skipping?: boolean): void | Promise<void>;
}

export interface ViewStep {
    getComponent(manager: ViewStepManager): Promise<ComponentWithProperties> | ComponentWithProperties;
    isEnabled(manager: ViewStepManager): boolean;
}
