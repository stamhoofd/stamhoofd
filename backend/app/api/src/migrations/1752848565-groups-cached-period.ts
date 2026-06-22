import { Migration } from '@simonbackx/simple-database';
import { Group, RegistrationPeriod } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    const dryRun = false;
    await start(dryRun);

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
});

/**
 * Groups in v1 have no cached period. This migration adds cached periods to groups that have no cached period yet.
 * @param dryRun
 */
async function start(dryRun: boolean) {
    await SeedTools.loop({
        query: Group.select(),
        batchSize: 50,
        useTransactionPerBatch: true,
        action: async (group: Group) => {
            if (group.settings.period !== null) {
                return;
            }

            const period = await RegistrationPeriod.getByID(group.periodId);
            if (period) {
                group.settings.period = period.getBaseStructure();
                if (!dryRun) {
                    await group.save();
                }
                return;
            }

            throw new Error(`No period found for group ${group.id} (periodId: ${group.periodId})`);
        },

    });
}
