import { Database, Migration } from '@simonbackx/simple-database';
import { BalanceItemStatus } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    const query = `
        UPDATE
            balance_items
        SET status = ?
        WHERE status IN (?)`;
    await Database.update(query, [
        BalanceItemStatus.Due,
        ['Paid', 'Pending'],
    ]);

    const q2 = `
        UPDATE
            balance_items
        SET status = ?,
            amount = coalesce(nullif(ROUND(coalesce(pricePaid / nullif(unitPrice, 0), 0)), 0), 1)
        WHERE amount = 0 AND status = ?`;
    await Database.update(q2, [
        BalanceItemStatus.Canceled,
        BalanceItemStatus.Due,
    ]);
});
