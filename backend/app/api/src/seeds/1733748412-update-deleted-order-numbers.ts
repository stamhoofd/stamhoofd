import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { Order, WebshopCounter } from '@stamhoofd/models';
import { OrderStatus } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let pages = 0;
    let id: string = '';

    await logger.setContext({tags: ['silent-seed', 'seed']}, async () => {
        while(true) {
            const orders = await Order.where({
                id: {
                    value: id,
                    sign: '>'
                },
                status: OrderStatus.Deleted,
            }, {limit: 100, sort: ['id']});

            if (orders.length === 0) {
                break;
            }

            pages++;
            process.stdout.write('.');
            if (pages%100 === 0) {
                process.stdout.write('\n');
            }

            for (const order of orders) {
                c++;

                if (order.status === OrderStatus.Deleted) {
                    order.data.removePersonalData()

                    if (order.number !== null) {
                        order.number = Math.floor(Math.random() * 1000000000000) + 1000000000000
                    }
                    await order.save()
                }
            }

            if (orders.length < 100) {
                break;
            }
            id = orders[orders.length - 1].id;
        }
    })

    console.log("Cleared "+c+" deleted orders")

    // Clear all cached order numbers
    WebshopCounter.clearAll()

    // Do something here
    return Promise.resolve()
});

