import { Migration } from '@simonbackx/simple-database';
import { Order } from '@stamhoofd/models';
import { LoggingTools } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start saving orders.');

    const batchProcessor = SeedTools.createBatchProcessor({
        batchSize: 100,
        action: async (order: Order) => {
            await order.save();
        },
    });

    const ordersProgressLogger = await LoggingTools.createProgressLoggerFromQuery(Order.select(), { tag: 'Update-orders' });
    batchProcessor.setProgressLogger(ordersProgressLogger);

    for await (const order of Order.select().limit(150).all()) {
        await batchProcessor.execute(order);
    }

    await batchProcessor.finish();

    console.log('Finished saving ' + ordersProgressLogger.total + ' orders.');
});
