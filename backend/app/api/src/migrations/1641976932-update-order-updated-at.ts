import { Migration } from '@simonbackx/simple-database';
import { Order, Payment } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    let lastId = ""

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

        const paymentIds = orders.map(o => o.paymentId).filter(p => !!p) as string[]
        const payments = paymentIds.length > 0 ? await Payment.getByIDs(...paymentIds) : []

        lastId = orders[orders.length - 1].id

        for (const order of orders) {
            const payment = payments.find(p => p.id === order.paymentId)

            if (payment && payment.updatedAt > order.updatedAt) {
                order.markUpdated()
                await order.save()
            }
        }
    }
});


