import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { BalanceItem } from '@stamhoofd/models';
import { LoggingTools } from '../helpers/LoggingTools.js';
import { BalanceItemService } from '../services/BalanceItemService.js';

/**
 * This migration is required to keep '1733994455-balance-item-status-open' working
 */
export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    process.stdout.write('\n');

    const progressLogger = await LoggingTools.createProgressLoggerFromQuery(BalanceItem.select());

    await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
        for await (const items of BalanceItem.select().limit(1000).allBatched()) {
            await BalanceItemService.updatePaidAndPending(items);
            progressLogger.update(items.length);
        }
    });

    console.log('Updated outstanding balance for ' + progressLogger.total + ' items');

    // Do something here
    return Promise.resolve();
});
