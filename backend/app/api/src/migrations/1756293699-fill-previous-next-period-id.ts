import { Migration } from '@node/database';
import { logger } from '@node/logging';
import { Organization, Platform } from '@stamhoofd/models';
import { RegistrationPeriodService } from '@stamhoofd/models/services/RegistrationPeriodService.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    process.stdout.write('\n');

    await logger.setContext({ tags: ['seed'] }, async () => {
        if (STAMHOOFD.userMode === 'platform') {
            await RegistrationPeriodService.updatePreviousNextPeriods(null);
        } else {
            for await (const organization of Organization.select().all()) {
                await RegistrationPeriodService.updatePreviousNextPeriods(organization.id);
            }
        }
    });
    console.log('Updated periods');

    // Now update platform
    const platform = await Platform.getForEditing();
    await platform.setPreviousPeriodId();
    await platform.save();

    console.log('Updated platform');

    // Do something here
    return Promise.resolve();
});
