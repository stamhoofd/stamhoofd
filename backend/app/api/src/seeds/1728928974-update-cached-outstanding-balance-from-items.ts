import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { BalanceItem } from '@stamhoofd/models';
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
    let c = 0;

    await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
        for await (const items of BalanceItem.select().limit(1000).allBatched()) {
            await BalanceItemService.updatePaidAndPending(items);

            c += items.length;
            process.stdout.write('.');
        }
    });

    console.log('Updated outstanding balance for ' + c + ' items');

    // Do something here
    return Promise.resolve();
});
