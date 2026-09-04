import { Migration } from '@simonbackx/simple-database';
import { BalanceItem, InvoicedBalanceItem } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';

/**
 * Copies type, relations, startDate and endDate from the balance item to the invoiced balance items that were
 * created before these columns existed.
 *
 * Only invoiced balance items without relations and without dates are touched, so this is idempotent.
 */
export async function backfillInvoicedBalanceItemDetails(): Promise<{ total: number; updated: number }> {
    let updated = 0;

    const result = await SeedTools.loopBatched({
        batchSize: 100,
        query: InvoicedBalanceItem.select().where('startDate', null).where('endDate', null),
        batchAction: async (items: InvoicedBalanceItem[]) => {
            const balanceItemIds = Formatter.uniqueArray(items.map(i => i.balanceItemId));
            const balanceItems = await BalanceItem.getByIDs(...balanceItemIds);
            const balanceItemMap = new Map(balanceItems.map(b => [b.id, b]));

            for (const item of items) {
                if (item.relations.size > 0) {
                    continue;
                }

                const balanceItem = balanceItemMap.get(item.balanceItemId);
                if (!balanceItem) {
                    continue;
                }

                if (item.type === balanceItem.type && balanceItem.relations.size === 0 && balanceItem.startDate === null && balanceItem.endDate === null) {
                    continue;
                }

                item.type = balanceItem.type;
                item.relations = new Map(balanceItem.relations);
                item.startDate = balanceItem.startDate;
                item.endDate = balanceItem.endDate;
                await item.save();
                updated++;
            }
        },
    });

    return { total: result.total, updated };
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        // Covered by 1788509900-fill-invoiced-balance-item-details.test.ts
        console.log('skipped in tests');
        return;
    }

    const result = await backfillInvoicedBalanceItemDetails();
    console.log(`Filled in details of ${result.updated} of ${result.total} invoiced balance items.`);
});
