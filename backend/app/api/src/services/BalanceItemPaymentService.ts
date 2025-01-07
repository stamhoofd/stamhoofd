import { ManyToOneRelation } from '@simonbackx/simple-database';
import { BalanceItemPayment, Organization } from '@stamhoofd/models';
import { BalanceItemStatus } from '@stamhoofd/structures';
import { BalanceItemService } from './BalanceItemService';

type Loaded<T> = (T) extends ManyToOneRelation<infer Key, infer Model> ? Record<Key, Model> : never;

export const BalanceItemPaymentService = {
    async markPaid(balanceItemPayment: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        const wasPaid = balanceItemPayment.balanceItem.isPaid;

        // Update cached amountPaid of the balance item (balanceItemPayment will get overwritten later, but we need it to calculate the status)
        balanceItemPayment.balanceItem.pricePaid += balanceItemPayment.price;

        if (balanceItemPayment.balanceItem.status === BalanceItemStatus.Hidden && balanceItemPayment.balanceItem.pricePaid !== 0) {
            balanceItemPayment.balanceItem.status = BalanceItemStatus.Due;
        }

        await balanceItemPayment.balanceItem.save();
        const isPaid = balanceItemPayment.balanceItem.isPaid;

        // Do logic of balance item
        if (isPaid && !wasPaid && balanceItemPayment.price >= 0 && balanceItemPayment.balanceItem.status === BalanceItemStatus.Due) {
            // Only call markPaid once (if it wasn't (partially) paid before)
            await BalanceItemService.markPaid(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
        }
        else {
            await BalanceItemService.markUpdated(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
        }
    },

    /**
     * Safe method to correct balance items that missed a markPaid call, but avoid double marking an order as valid.
     */
    async markPaidRepeated(balanceItemPayment: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        const isPaid = balanceItemPayment.balanceItem.isPaid;

        // Do logic of balance item
        if (isPaid && balanceItemPayment.price >= 0 && balanceItemPayment.balanceItem.status === BalanceItemStatus.Due) {
            await BalanceItemService.markPaidRepeated(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
        }
    },

    /**
     * Call balanceItemPayment once a earlier succeeded payment is no longer succeeded
     */
    async undoPaid(balanceItemPayment: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        await BalanceItemService.undoPaid(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
    },

    async markFailed(balanceItemPayment: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        // Do logic of balance item
        await BalanceItemService.markFailed(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
    },

    async undoFailed(balanceItemPayment: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        // Reactivate deleted items
        await BalanceItemService.undoFailed(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
    },

};
