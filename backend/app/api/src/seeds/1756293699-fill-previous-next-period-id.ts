import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { Organization, Platform, RegistrationPeriod } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    process.stdout.write('\n');

    await logger.setContext({ tags: ['seed'] }, async () => {
        if (STAMHOOFD.userMode === 'platform') {
            await RegistrationPeriod.updatePreviousNextPeriods(null);
        }
        else {
            for await (const organization of Organization.select().all()) {
                await RegistrationPeriod.updatePreviousNextPeriods(organization.id);
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
