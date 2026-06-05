import { Migration } from '@simonbackx/simple-database';
import { Registration } from '@stamhoofd/models';
import { LoggingTools } from '../helpers/LoggingTools.js';
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

    const batchProcessor = SeedTools.createBatchProcessor({
        batchSize: 100,
        action: async (registration: Registration) => {
            await RegistrationService.scheduleStockUpdateAsync(registration.id);
        },
    });

    const progressLogger = await LoggingTools.createProgressLoggerFromQuery(Registration.select());
    batchProcessor.setProgressLogger(progressLogger);

    for await (const registration of Registration.select().all()) {
        await batchProcessor.execute(registration);
    }
});
