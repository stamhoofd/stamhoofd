import { ManyToOneRelation } from '@simonbackx/simple-database';
import { BalanceItemPayment, Organization } from '@stamhoofd/models';
import { BalanceItemStatus } from '@stamhoofd/structures';
import { BalanceItemService } from './BalanceItemService';

type Loaded<T> = (T) extends ManyToOneRelation<infer Key, infer Model> ? Record<Key, Model> : never;

export const BalanceItemPaymentService = {
    async markPaid(balanceItemPayment: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        // Update cached amountPaid of the balance item (balanceItemPayment will get overwritten later, but we need it to calculate the status)
        balanceItemPayment.balanceItem.pricePaid += balanceItemPayment.price;

        // Update status
        const old = balanceItemPayment.balanceItem.status;
        balanceItemPayment.balanceItem.updateStatus();
        await balanceItemPayment.balanceItem.save();

        // Do logic of balance item
        if (balanceItemPayment.balanceItem.status === BalanceItemStatus.Paid && old !== BalanceItemStatus.Paid) {
            // Only call markPaid once (if it wasn't (partially) paid before)
            await BalanceItemService.markPaid(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
        }
        else {
            await BalanceItemService.markUpdated(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
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
