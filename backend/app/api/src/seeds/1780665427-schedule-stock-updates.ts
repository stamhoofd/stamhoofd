import { Migration } from '@simonbackx/simple-database';
import { Registration } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';
import { RegistrationService } from '../services/RegistrationService.js';
import { QueryableModel } from '@stamhoofd/sql';
import { QueueHandler } from '@stamhoofd/queues';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode === 'platform') {
        console.log('skipped seed schedule-stock-updates because usermode platform');
        return;
    }

    const result = await SeedTools.loopBatched({
        query: Registration.select('id'),
        batchSize: 2_000,
        // dot not use transactions here: this breaks the stock behaviour
        batchAction: async (registrations: Registration[]) => {
            for (const registration of registrations) {
                await RegistrationService.scheduleStockUpdateAsync(registration.id);

                if (QueryableModel.shutdownMigrations) {
                    break;
                }
            }

            // Immediate tasks scheduled on group updates
            await QueueHandler.awaitAll();

            // Recursive tasks
            await QueueHandler.awaitAll();

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Stopping migration gracefully');
            }
        },
    });

    console.log('Looped ' + result.total + ' registrations');
});
