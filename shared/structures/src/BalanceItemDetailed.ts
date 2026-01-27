import { field } from '@simonbackx/simple-encoding';

import { Formatter } from '@stamhoofd/utility';
import { BalanceItem, BalanceItemPayment } from './BalanceItem.js';
import { RegistrationWithTinyMember } from './members/RegistrationWithTinyMember.js';
import { Order } from './webshops/Order.js';

// Do we still need this?
export class BalanceItemDetailed extends BalanceItem {
    @field({ decoder: RegistrationWithTinyMember, nullable: true })
    registration: RegistrationWithTinyMember | null = null;

    @field({ decoder: Order, nullable: true })
    order: Order | null = null;
}

export class BalanceItemPaymentDetailed extends BalanceItemPayment {
    @field({ decoder: BalanceItem })
    balanceItem: BalanceItem;

    /**
     * @deprecated Use quantity to avoid confustion with quantity vs prices (amounts)
     * Note: this can be a float in case of partial payments
     * Try to avoid using this in calculations, as this is not super reliable
     *
     * Always round when displaying!
     */
    get amount() {
        return this.quantity;
    }

    /**
     * Note: this can be a float in case of partial payments
     * Try to avoid using this in calculations, as this is not super reliable
     *
     * Always round when displaying!
     */
    get quantity() {
        if (this.unitPrice === 0) {
            // Not possible to calculate amount
            return this.balanceItem.amount;
        }

        return this.price / this.unitPrice;
    }

    get unitPrice() {
        if (this.price < 0 && this.balanceItem.unitPriceWithVAT > 0) {
            return -this.balanceItem.unitPriceWithVAT;
        }
        return this.balanceItem.unitPriceWithVAT;
    }

    /**
     * When displayed as a single item
     */
    get itemTitle(): string {
        return this.balanceItem.itemTitle;
    }

    /**
     * When displayed as a single item
     */
    get itemDescription() {
        return this.balanceItem.itemDescription;
    }

    toString() {
        return Formatter.float(this.amount) + 'x ' + this.itemTitle + (this.itemDescription ? ' (' + this.itemDescription + ')' : '');
    }
}
