import { Migration } from '@simonbackx/simple-database';
import { Order } from '@stamhoofd/models';
import { QueryableModel } from '@stamhoofd/sql';
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
    let realUpdate = 0;

    const result = await SeedTools.loop({
        query: Order.select().where('updatedAt', '<', new Date(Date.now() - 1_000 * 60 * 60 * 5)),
        batchSize: 200,
        useTransactionPerBatch: true,
        action: async (order: Order) => {
            if (await order.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            })) {
                realUpdate += 1;
            }

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Stopping migration gracefully');
            }
        },
    });

    console.log('Updated ' + realUpdate + ' orders out of ' + result.total + ' looped orders');
});
