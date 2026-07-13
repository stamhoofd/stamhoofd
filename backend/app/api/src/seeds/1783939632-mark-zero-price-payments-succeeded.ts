import { Migration } from '@simonbackx/simple-database';
import { Organization, Payment } from '@stamhoofd/models';
import { QueryableModel } from '@stamhoofd/sql';
import { PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';
import { PaymentService } from '../services/PaymentService.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start marking zero-price payments as succeeded.');

    let succeeded = 0;

    const result = await SeedTools.loopBatched({
        // Keyset pagination on id: marking a payment as succeeded drops it from this filter,
        // but rows are never skipped because each next batch is fetched by id > lastId.
        query: Payment.select()
            .where('price', 0)
            .where('status', [PaymentStatus.Created, PaymentStatus.Pending]),
        batchSize: 100,
        batchAction: async (payments: Payment[]) => {
            // Load the organizations of this batch in bulk
            const organizationIds = Formatter.uniqueArray(
                payments.map(p => p.organizationId).filter((id): id is string => id !== null),
            );
            const organizations = organizationIds.length ? await Organization.getByIDs(...organizationIds) : [];

            // Load the attached balance item payments of this batch in bulk, and collect the ids of
            // the payments that move money on at least one balance item. Those need the PaymentService
            // side effects (marking balance items as paid, flushing caches, ...); the rest can be
            // updated directly.
            const { balanceItemPayments } = await Payment.loadBalanceItems(payments);
            const paymentIdsWithNonZeroBalanceItemPayment = new Set(
                balanceItemPayments.filter(bip => bip.price !== 0).map(bip => bip.paymentId),
            );

            for (const payment of payments) {
                // Only route through the PaymentService when the payment moves money on at least one
                // balance item. When all attached balance item payments are zero (or there are none),
                // update the status directly to avoid those side effects.
                const hasNonZeroBalanceItemPayment = paymentIdsWithNonZeroBalanceItemPayment.has(payment.id);

                try {
                    if (hasNonZeroBalanceItemPayment) {
                        if (!payment.organizationId) {
                            console.warn('Payment without organizationId, skipping', payment.id);
                            continue;
                        }

                        const organization = organizations.find(o => o.id === payment.organizationId);
                        if (!organization) {
                            console.warn('Organization not found for payment, skipping', payment.id, payment.organizationId);
                            continue;
                        }

                        // Attribute the payment to its original date instead of the migration run date.
                        await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Succeeded, payment.createdAt);
                    } else {
                        // No side effects needed: update the status directly.
                        payment.status = PaymentStatus.Succeeded;
                        payment.paidAt = payment.createdAt;
                        await payment.save({
                            skipMarkSaved: true,
                            skipSendEvents: true,
                        });
                    }
                    succeeded++;
                } catch (e) {
                    // Isolate failures per payment: one bad row should not abort (and wedge) the whole migration.
                    console.error('Failed to mark payment as succeeded, skipping', payment.id, e);
                }

                if (QueryableModel.shutdownMigrations) {
                    break;
                }
            }

            if (QueryableModel.shutdownMigrations) {
                throw new Error('Stopping migration gracefully');
            }
        },
    });

    console.log(`Finished marking zero-price payments as succeeded: ${succeeded} of ${result.total} payments.`);
});
