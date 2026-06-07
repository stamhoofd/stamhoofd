import { Migration } from '@simonbackx/simple-database';
import { Registration } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';
import { RegistrationService } from '../services/RegistrationService.js';
import { QueryableModel } from '@stamhoofd/sql';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode === 'platform') {
        console.log('skipped seed schedule-stock-updates because usermode platform');
        return;
    }

    const result = await SeedTools.loop({
        query: Registration.select('id'),
        batchSize: 1000,
        // dot not use transactions here: this breaks the stock behaviour
        action: async (registration: Registration) => {
            await RegistrationService.scheduleStockUpdateAsync(registration.id);

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Stopping migration gracefully');
            }
        },
    });

    console.log('Looped ' + result.total + ' registrations');
});
