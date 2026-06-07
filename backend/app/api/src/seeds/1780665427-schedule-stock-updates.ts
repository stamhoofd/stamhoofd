import { Migration } from '@simonbackx/simple-database';
import { Registration } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';
import { RegistrationService } from '../services/RegistrationService.js';

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
        query: Registration.select(),
        batchSize: 100,
        action: async (registration: Registration) => {
            await RegistrationService.scheduleStockUpdateAsync(registration.id);
        },
    });

    console.log('Looped ' + result.total + ' registrations');
});
