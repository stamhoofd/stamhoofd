import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { Order, WebshopCounter } from '@stamhoofd/models';
import { OrderStatus } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let pages = 0;
    let id: string = '';

    // There is an issue with some deleted orders that can't be stringified anymore
    let limit = 100;
    let restoreLimitAt: number | null = null;

    await logger.setContext({ tags: ['seed'] }, async () => {
        while (true) {
            try {
                const orders = await Order.where({
                    id: {
                        value: id,
                        sign: '>',
                    },
                    status: OrderStatus.Deleted,
                }, { limit, sort: ['id'] });

                if (orders.length === 0) {
                    break;
                }

                pages++;
                process.stdout.write('.');
                if (pages % 100 === 0) {
                    process.stdout.write('\n');
                }

                if (limit === 1 && restoreLimitAt && pages > restoreLimitAt) {
                    limit = 100;
                }

                for (const order of orders) {
                    c++;

                    if (order.status === OrderStatus.Deleted) {
                        order.data.removePersonalData();

                        if (order.number !== null) {
                            order.number = Math.floor(Math.random() * 1000000000000) + 1000000000000;
                        }
                        await order.save();
                    }
                }

                if (orders.length < limit) {
                    break;
                }
                id = orders[orders.length - 1].id;
            }
            catch (e) {
                if (e.toString() && e.toString().includes('RangeError')) {
                    console.error('Found decoding issue at ' + id);
                    console.error(e);
                    if (limit === 1) {
                        // We found the causing order.

                        const _orders = await Order.where({
                            id: {
                                value: id,
                                sign: '>',
                            },
                            status: OrderStatus.Deleted,
                        }, { limit: 1, sort: ['id'], select: 'id' });

                        if (_orders.length === 1) {
                            console.log('Found broken order: ' + _orders[0].id);
                            console.log('Deleting order');
                            // Delete
                            await _orders[0].delete();
                        }
                        else {
                            console.error('Could not find causing order');
                            throw e;
                        }
                    }
                    // Something wrong with an order
                    // continue
                    limit = 1;
                    restoreLimitAt = pages + 100;
                    continue;
                }
                console.error('Error at ' + id);
                throw e;
            }
        }
    });

    console.log('Cleared ' + c + ' deleted orders');

    // Clear all cached order numbers
    WebshopCounter.clearAll();

    // Do something here
    return Promise.resolve();
});
