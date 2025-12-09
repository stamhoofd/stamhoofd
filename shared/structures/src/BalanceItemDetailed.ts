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
     * Note: this can be a float in case of partial payments
     * Try to avoid using this in calculations, as this is not super reliable
     *
     * Always round when displaying!
     */
    get amount() {
        if (this.unitPrice === 0) {
            // Not possible to calculate amount
            return this.balanceItem.amount;
        }

        return this.price / this.unitPrice;
    }

    /**
     * NOTE! This unit price could be including or exluding vat depending on the balance item
     */
    get unitPrice() {
        if (this.price < 0 && this.balanceItem.unitPrice > 0) {
            return -this.balanceItem.unitPrice;
        }
        return this.balanceItem.unitPrice;
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
