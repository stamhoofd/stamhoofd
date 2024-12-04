import { SetupStepUpdater } from '../helpers/SetupStepUpdater.js';

export async function updateSetupSteps() {
    if (STAMHOOFD.userMode !== 'platform') {
        return;
    }

    await SetupStepUpdater.updateSetupStepsForAllOrganizationsInCurrentPeriod();
}
