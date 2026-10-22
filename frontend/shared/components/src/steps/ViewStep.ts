import type {ComponentWithProperties} from '@simonbackx/vue-app-navigation';
import type { NavigationActions } from '../types/NavigationActions';

export interface ViewStepNavigation {
    saveHandler(currentStep: ViewStep | null, navigate: NavigationActions, skipping?: boolean): void | Promise<void>;
}

export interface ViewStep {
    getComponent(navigation: ViewStepNavigation): Promise<ComponentWithProperties> | ComponentWithProperties;
    isEnabled(navigation: ViewStepNavigation): boolean;
}
