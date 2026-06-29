import { Migration } from '@simonbackx/simple-database';
import { Order, Payment } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        // The customer is filled in directly when the payment is created (see PatchWebshopOrdersEndpoint),
        // which is covered by PlaceOrderEndpoint.test.ts.
        console.log('skipped in tests');
        return;
    }

    // Note: unlike 1780915001-fill-payment-customer, there is no platformName guard here.
    // Manually added webshop orders never stored a payment customer on any platform, so every
    // platform needs this fix.

    console.log('Start filling in payment customers for orders.');

    let filled = 0;

    const result = await SeedTools.loopBatched({
        query: Payment.select().where('customer', null),
        batchSize: 1000,
        batchAction: async (payments: Payment[]) => {
            // Load the balance items linked to the payments so we can find their orders in bulk.
            const { balanceItemPayments, balanceItems } = await Payment.loadBalanceItems(payments);

            const orderIds = Formatter.uniqueArray(balanceItems.map(b => b.orderId).filter((id): id is string => id !== null));
            const orders = orderIds.length ? await Order.getByIDs(...orderIds) : [];

            for (const payment of payments) {
                const paymentBalanceItemIds = balanceItemPayments.filter(bip => bip.paymentId === payment.id).map(bip => bip.balanceItemId);
                const linkedOrderIds = Formatter.uniqueArray(
                    balanceItems
                        .filter(b => paymentBalanceItemIds.includes(b.id))
                        .map(b => b.orderId)
                        .filter((id): id is string => id !== null),
                );

                // Only fill in the customer based on a linked order with usable billing details.
                for (const orderId of linkedOrderIds) {
                    const order = orders.find(o => o.id === orderId);
                    if (order && (order.data.customer.email || order.data.customer.name)) {
                        payment.customer = order.data.customer.toPaymentCustomer();
                        await payment.save({
                            skipMarkSaved: true,
                            skipSendEvents: true,
                        });
                        filled++;
                        break;
                    }
                }
            }
        },
    });

    console.log(`Finished filling in order payment customers: set ${filled} of ${result.total} payments.`);
});
