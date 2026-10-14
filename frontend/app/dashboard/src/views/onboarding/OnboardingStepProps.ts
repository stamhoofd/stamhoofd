import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { MemberAdministrationOnboardingViewModel } from './MemberAdministrationOnboardingViewModel';

export type OnboardingStepProps = {
    viewModel: MemberAdministrationOnboardingViewModel;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
    stepNumber: number;
    stepCount: number;
};
