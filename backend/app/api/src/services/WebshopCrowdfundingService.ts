import { BalanceItem, Order, Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLAlias, SQLSelectAs, SQLSum } from '@stamhoofd/sql';
import { BalanceItemStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { ThrottledQueue } from '../helpers/ThrottledQueue.js';

// Balance items only store the orderId, so the webshop is resolved inside the queue
const orderUpdateQueue = new ThrottledQueue(async (orderIds: string[]) => {
    const orders = await Order.getByIDs(...orderIds);
    const webshopIds = Formatter.uniqueArray(orders.map(o => o.webshopId));

    for (const webshopId of webshopIds) {
        await WebshopCrowdfundingService.updateForWebshop(webshopId);
    }
});

export class WebshopCrowdfundingService {
    /**
     * Update the cached crowdfunding amounts of the webshop of this order in the background.
     * Multiple calls within the throttle window (10s) result in a single update per webshop.
     */
    static scheduleUpdateForOrder(orderId: string) {
        // STAMHOOFD is not available yet when this module is loaded
        orderUpdateQueue.maxDelay = STAMHOOFD.environment === 'development' ? 1000 : 10_000;
        orderUpdateQueue.addItem(orderId);
    }

    /**
     * Make sure all scheduled updates have run (on shutdown and in tests).
     */
    static async flush() {
        await orderUpdateQueue.flushAndWait();
    }

    /**
     * Recalculates meta.crowdfunding.progressAmount (paid) and .pendingAmount (pending payments)
     * by summing the balance items of all orders of this webshop in a single query.
     * Does nothing when crowdfunding is not enabled (meta.crowdfunding is null).
     */
    static async updateForWebshop(webshopId: string) {
        // Same queue as stock updates: all webshop writes are serialized to prevent conflicting saves
        await QueueHandler.schedule('webshop-stock/' + webshopId, async () => {
            const webshop = await Webshop.getByID(webshopId);
            if (!webshop) {
                return;
            }

            await this.updateWebshop(webshop);
        });
    }

    /**
     * Same as updateForWebshop, but for an already loaded webshop. Should only be used inside
     * the webshop-stock queue of this webshop (where updateForWebshop would deadlock).
     */
    static async updateWebshop(webshop: Webshop) {
        const crowdfunding = webshop.meta.crowdfunding;
        if (!crowdfunding) {
            return;
        }

        // Only due balance items count: online payments keep their balance item hidden until
        // the payment succeeds, so their unresolved payments don't increase the pending amount.
        // Unconfirmed transfer and point of sale payments do (their balance item is due).
        const row = await SQL.select(
            new SQLSelectAs(
                new SQLSum(SQL.column(BalanceItem.table, 'pricePaid')),
                new SQLAlias('data__pricePaid'),
            ),
            new SQLSelectAs(
                new SQLSum(SQL.column(BalanceItem.table, 'pricePending')),
                new SQLAlias('data__pricePending'),
            ),
        )
            .from(BalanceItem.table)
            .join(
                SQL.join(Order.table)
                    .where(SQL.column(BalanceItem.table, 'orderId'), SQL.column(Order.table, 'id')),
            )
            .where(SQL.column(Order.table, 'webshopId'), webshop.id)
            .where(SQL.column(BalanceItem.table, 'status'), BalanceItemStatus.Due)
            .first(false);

        // Sums are null when the webshop has no balance items
        const progressAmount = typeof row?.['data']?.['pricePaid'] === 'number' ? row['data']['pricePaid'] : 0;
        const pendingAmount = typeof row?.['data']?.['pricePending'] === 'number' ? row['data']['pricePending'] : 0;

        if (crowdfunding.progressAmount === progressAmount && crowdfunding.pendingAmount === pendingAmount) {
            return;
        }

        crowdfunding.progressAmount = progressAmount;
        crowdfunding.pendingAmount = pendingAmount;
        await webshop.save();
    }
}
