import { Migration } from '@simonbackx/simple-database';

import { Order } from '../models/Order';
import { Webshop } from '../models/Webshop';

/**
 * Set the reservedAmount for all orders if they were included in the stock
 */
export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    let lastId = ""
    const shopBuffer = new Map<string, Webshop>()

    // eslint-disable-next-line no-constant-condition
    while(true) {
        const orders = await Order.where({ id: { sign: '>', value: lastId } }, {
            limit: 1000,
            sort: ["id"]
        })
        process.stdout.write(".")

        if (orders.length == 0) {
            break
        }

        for (const order of orders) {
            if (order.shouldIncludeStock() && order.data.timeSlot) {
                const webshop = shopBuffer.get(order.webshopId) ?? await Webshop.getByID(order.webshopId)
                if (webshop){
                    shopBuffer.set(order.webshopId, webshop)
                    await order.setRelation(Order.webshop, webshop).updateStock()
                }
            }
        }

        lastId = orders[orders.length - 1].id
    }
    process.stdout.write("\nDone.\n")
});


