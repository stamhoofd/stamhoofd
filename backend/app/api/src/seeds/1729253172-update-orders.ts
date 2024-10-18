import { Migration } from '@simonbackx/simple-database';
import { Order } from '@stamhoofd/models';
import { sleep } from '@stamhoofd/utility';
import { ModelHelper } from '../helpers/ModelHelper';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start saving orders.');

    const limit = 100;
    let count = limit;

    await ModelHelper.loop(Order, 'id', async (batch: Order[]) => {
        console.log('Saving orders...', `(${count})`);
        // save all orders to update the new columns
        await Promise.all(batch.map(order => order.save()));
        count += limit;
    },
    { limit });

    await sleep(1000);

    console.log('Finished saving orders.');
});
