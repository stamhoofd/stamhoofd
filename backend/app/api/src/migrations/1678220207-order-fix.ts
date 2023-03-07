import { Migration } from '@simonbackx/simple-database';
import { Order } from '@stamhoofd/models';
import { OrderStatus } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

   const orders = await Order.where({
        paymentId: null,
        number: null,
        status: OrderStatus.Created,
    })

    for (const order of orders) {
        // Mark failed
        await order.onPaymentFailed()
    }
});