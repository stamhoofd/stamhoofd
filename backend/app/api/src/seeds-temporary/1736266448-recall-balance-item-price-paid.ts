import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { BalanceItem, BalanceItemPayment, Organization, Payment } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { AuditLogSource, PaymentStatus } from '@stamhoofd/structures';
import { AuditLogService } from '../services/AuditLogService';
import { BalanceItemPaymentService } from '../services/BalanceItemPaymentService';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    process.stdout.write('\n');
    let c = 0;

    await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
        const q = Payment.select()
            .where('status', PaymentStatus.Succeeded)
            .where('createdAt', '>=', new Date('2024-12-12'))
            .limit(100);
        for await (const payment of q.all()) {
            await fix(payment);

            c += 1;

            if (c % 1000 === 0) {
                process.stdout.write('.');
            }
        }
    });

    console.log('Updated ' + c + ' payments');

    // Do something here
    return Promise.resolve();
});

async function fix(payment: Payment) {
    if (payment.status !== PaymentStatus.Succeeded) {
        return;
    }

    if (!payment.organizationId) {
        return;
    }

    const organization = await Organization.getByID(payment.organizationId);

    if (!organization) {
        return;
    }

    await AuditLogService.setContext({ fallbackUserId: payment.payingUserId, source: AuditLogSource.Payment, fallbackOrganizationId: payment.organizationId }, async () => {
        // Prevent concurrency issues
        await QueueHandler.schedule('balance-item-update/' + organization.id, async () => {
            const unloaded = (await BalanceItemPayment.where({ paymentId: payment.id })).map(r => r.setRelation(BalanceItemPayment.payment, payment));
            const balanceItemPayments = await BalanceItemPayment.balanceItem.load(
                unloaded,
            );

            for (const balanceItemPayment of balanceItemPayments) {
                await BalanceItemPaymentService.markPaidRepeated(balanceItemPayment, organization);
            }

            await BalanceItem.updateOutstanding(balanceItemPayments.map(p => p.balanceItem));
        });
    });
}
