import { Database, Migration } from '@simonbackx/simple-database';
import { Order, Organization, Payment } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    const query = `select webshop_orders.* from webshop_orders join payments on payments.id = webshop_orders.paymentId where payments.status = 'Succeeded' and webshop_orders.status = 'Created' and webshop_orders.validAt is null and webshop_orders.createdAt > "2025-01-01" limit 100;`

    const [rows] = await Database.select(query);
    const orders = Order.fromRows(rows, 'webshop_orders');

    for (const order of orders) {
        if (!order.paymentId) {
            console.log('No paymentId for order ' + order.id);
            continue;
        }
        console.log('Correcting order ' + order.id);
        const payment = await Payment.getByID(order.paymentId);
        const organization = await Organization.getByID(order.organizationId);

        if (!payment) {
            console.log('No payment for order ' + order.id);
            continue;
        }
        if (!organization) {
            console.log('No organization for order ' + order.id);
            continue;
        }
        await order.markPaid(payment, organization);
    }

    console.log('Corrected ' + orders.length + ' orders');

    // Do something here
    return Promise.resolve();
});
