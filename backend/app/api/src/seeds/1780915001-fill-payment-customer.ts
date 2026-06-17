import { Migration } from '@simonbackx/simple-database';
import { Member, Order, Organization, Payment, User } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';
import { determinePaymentCustomer } from '../helpers/PaymentCustomerResolver.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        // The customer determination is covered directly by PaymentCustomerResolver.test.ts
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'stamhoofd') {
        // In v1 only the Stamhoofd platform stored payments without a customer.
        return;
    }

    console.log('Start filling in payment customers.');

    let filled = 0;

    const result = await SeedTools.loopBatched({
        query: Payment.select().where('customer', null),
        batchSize: 1000,
        batchAction: async (payments: Payment[]) => {
            // Load all the related data needed to determine the customers in bulk.
            const { balanceItemPayments, balanceItems } = await Payment.loadBalanceItems(payments);
            const { payingOrganizations } = await Payment.loadPayingOrganizations(payments);

            const memberIds = Formatter.uniqueArray(balanceItems.map(b => b.memberId).filter((id): id is string => id !== null));
            const userIds = Formatter.uniqueArray([
                ...payments.map(p => p.payingUserId),
                ...balanceItems.map(b => b.userId),
            ].filter((id): id is string => id !== null));
            const orderIds = Formatter.uniqueArray(balanceItems.map(b => b.orderId).filter((id): id is string => id !== null));
            const balanceItemPayingOrganizationIds = Formatter.uniqueArray(balanceItems.map(b => b.payingOrganizationId).filter((id): id is string => id !== null));

            const members = memberIds.length ? await Member.getByIDs(...memberIds) : [];
            const users = userIds.length ? await User.getByIDs(...userIds) : [];
            const orders = orderIds.length ? await Order.getByIDs(...orderIds) : [];
            const extraOrganizations = balanceItemPayingOrganizationIds.length ? await Organization.getByIDs(...balanceItemPayingOrganizationIds) : [];
            const allPayingOrganizations = [...payingOrganizations, ...extraOrganizations.filter(o => !payingOrganizations.some(p => p.id === o.id))];

            for (const payment of payments) {
                const paymentBalanceItemIds = balanceItemPayments.filter(bip => bip.paymentId === payment.id).map(bip => bip.balanceItemId);
                const paymentBalanceItems = balanceItems.filter(b => paymentBalanceItemIds.includes(b.id));

                const customer = determinePaymentCustomer(payment, {
                    balanceItems: paymentBalanceItems,
                    members,
                    users,
                    orders,
                    payingOrganizations: allPayingOrganizations,
                });

                if (customer) {
                    payment.customer = customer;
                    await payment.save({
                        skipMarkSaved: true,
                        skipSendEvents: true,
                    });
                    filled++;
                }
            }
        },
    });

    console.log(`Finished filling in payment customers: set ${filled} of ${result.total} payments.`);
});
