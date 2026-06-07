import { Migration } from '@simonbackx/simple-database';
import { Order } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'stamhoofd') {
        // Already ran, or not required for new servers
        return;
    }

    console.log('Start saving orders.');

    const result = await SeedTools.loop({
        query: Order.select(),
        batchSize: 1000,
        useTransactionPerBatch: true,
        action: async (order: Order) => {
            await order.save();
        },
    });

    console.log('Finished saving ' + result.total + ' orders.');
});
