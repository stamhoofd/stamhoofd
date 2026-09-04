import { Migration } from '@simonbackx/simple-database';
import { Payment } from '@stamhoofd/models';
import { QueryableModel, scalarToSQLExpression, SQL, SQLWhereLike } from '@stamhoofd/sql';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';

import { ApplicationFeeInvoicer } from '../helpers/ApplicationFeeInvoicer.js';
import { SeedTools } from '../helpers/SeedTools.js';
import { FEE_PAYMENT_REFERENCE_PREFIX } from '../services/ApplicationFeeService.js';

/**
 * Fee payments and their balance items were marked paid at the time the invoicer ran instead of at
 * local midnight of the billed day.
 */
export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    console.log('Start fixing paidAt of application fee payments.');

    let fixed = 0;
    let skipped = 0;

    const result = await SeedTools.loopBatched({
        query: Payment.select()
            .where('method', PaymentMethod.AccountDeductions)
            .where('status', PaymentStatus.Succeeded)
            .where(new SQLWhereLike(SQL.column(Payment.table, 'reference'), scalarToSQLExpression(FEE_PAYMENT_REFERENCE_PREFIX + '%')))
            .orderBy('id', 'ASC'),
        batchSize: 100,
        batchAction: async (payments: Payment[]) => {
            const { balanceItemPayments, balanceItems } = await Payment.loadBalanceItems(payments);

            for (const payment of payments) {
                const day = parseDay(payment.reference);
                if (!day) {
                    console.warn('Unparsable reference, skipping', payment.id, payment.reference);
                    skipped++;
                    continue;
                }

                const itemIds = balanceItemPayments.filter(b => b.paymentId === payment.id).map(b => b.balanceItemId);
                if (itemIds.length < 1 || itemIds.length > 2) {
                    console.warn('Unexpected number of balance items, skipping', payment.id, itemIds.length);
                    skipped++;
                    continue;
                }

                const paidAt = ApplicationFeeInvoicer.paidAt(day);
                let changed = false;

                if (payment.paidAt?.getTime() !== paidAt.getTime()) {
                    payment.paidAt = paidAt;
                    await payment.save();
                    changed = true;
                }

                for (const item of balanceItems.filter(i => itemIds.includes(i.id))) {
                    if (item.paidAt === null || item.paidAt.getTime() === paidAt.getTime()) {
                        continue;
                    }
                    item.paidAt = paidAt;
                    await item.save();
                    changed = true;
                }

                if (changed) {
                    fixed++;
                }

                if (QueryableModel.shutdownMigrations) {
                    throw new Error('Stopping migration gracefully');
                }
            }
        },
    });

    console.log(`Finished fixing paidAt of application fee payments: ${fixed} fixed, ${skipped} skipped of ${result.total} payments.`);
});

function parseDay(reference: string | null): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reference?.slice(FEE_PAYMENT_REFERENCE_PREFIX.length) ?? '');
    if (!match) {
        return null;
    }
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
