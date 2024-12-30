import { Migration } from '@simonbackx/simple-database';
import { Order } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start saving orders.');

    const batchSize = 100;
    let count = 0;

    for await (const order of Order.select().limit(batchSize).all()) {
        await order.save();
        count += 1;
    }

    console.log('Finished saving ' + count + ' orders.');
});
