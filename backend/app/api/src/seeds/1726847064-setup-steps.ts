import { Migration } from '@simonbackx/simple-database';
import { SetupStepUpdater } from '../helpers/SetupStepUpdater.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode !== 'platform') {
        console.log('skipped seed setup-steps because usermode not platform');
        return;
    }

    await SetupStepUpdater.updateSetupStepsForAllOrganizationsInCurrentPeriod();
});
