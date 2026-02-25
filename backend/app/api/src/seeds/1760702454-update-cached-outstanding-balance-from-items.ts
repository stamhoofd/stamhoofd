import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { BalanceItem } from '@stamhoofd/models';
import { BalanceItemService } from '../services/BalanceItemService.js';

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

    await BalanceItemService.flushAll();

    console.log('Updated outstanding balance for ' + c + ' items');

    // Do something here
    return Promise.resolve();
});
