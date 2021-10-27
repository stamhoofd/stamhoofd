import { Migration } from '@simonbackx/simple-database';
import { Order } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    let lastId = ""

    let count = 0

    while(true) {
        const orders = await Order.where({
            id: {
                sign: ">",
                value: lastId
            },
        }, {
            limit: 100,
            sort: ["id"]
        })

        if (orders.length == 0) {
            return
        }

        lastId = orders[orders.length - 1].id

        for (const order of orders) {
            count++

            if (count % 100 == 0) {
                console.log(count)
            }
            // Force price calculation of items
            const price = order.data.cart.price
            await order.save()
        }
    }
});


