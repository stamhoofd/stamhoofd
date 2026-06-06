import { Migration } from '@simonbackx/simple-database';
import { Order } from '@stamhoofd/models';
import { LoggingTools } from '@stamhoofd/utility';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start saving orders.');

    const batchSize = 100;

    const ordersProgressLogger = await LoggingTools.createProgressLoggerFromQuery(Order.select(), { tag: 'Update-orders' });

    for await (const order of Order.select().limit(batchSize).all()) {
        await order.save();
        ordersProgressLogger.update();
    }

    console.log('Finished saving ' + ordersProgressLogger.total + ' orders.');
});
