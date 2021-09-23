import { Migration } from '@simonbackx/simple-database';
import { Order } from '../models/Order';

/**
 * Set the reservedAmount for all orders if they were included in the stock
 */
export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    let lastId = ""
    let count = 0
    let countChecked = 0
    let countOrders = 0

    while(true) {
        const orders = await Order.where({ id: { sign: '>', value: lastId } }, {
            limit: 1000,
            sort: ["id"]
        })

        if (orders.length == 0) {
            // Wait again until next day
            break
        }
        

        for (const order of orders) {
            countOrders++
            if (order.shouldIncludeStock()) {
                countChecked++

                let changed = false
                for (const item of order.data.cart.items) {
                    if (item.product.stock !== null) {
                        item.reservedAmount = item.amount
                        changed = true
                    }
                }
                if (changed) {
                    count++
                    await order.save()
                }
            }
            
        }

        lastId = orders[orders.length - 1].id
    }

    console.log("Updated "+count+" orders")
    console.log("Checked "+countChecked+" orders")
    console.log("Total "+countOrders+" orders")

    throw new Error("Wip")
});


