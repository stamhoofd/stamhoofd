import { ManyToOneRelation } from '@simonbackx/simple-database';
import { BalanceItemPayment, Organization } from '@stamhoofd/models';
import { BalanceItemService } from './BalanceItemService.js';

type Loaded<T> = (T) extends ManyToOneRelation<infer Key, infer Model> ? Record<Key, Model> : never;

export const BalanceItemPaymentService = {
    async markPaid(balanceItemPayment: BalanceItemPayment & Loaded<typeof BalanceItemPayment.balanceItem> & Loaded<typeof BalanceItemPayment.payment>, organization: Organization) {
        await BalanceItemService.markPaid(balanceItemPayment.balanceItem, balanceItemPayment.payment, organization);
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
