import { field } from "@simonbackx/simple-encoding"

import { BalanceItem, BalanceItemPayment, BalanceItemRelationType, BalanceItemType, shouldAggregateOnRelationType } from "./BalanceItem"
import { RegistrationWithMember } from "./members/RegistrationWithMember"
import { Order } from "./webshops/Order"
import { Formatter } from "@stamhoofd/utility"

// Do we still need this?
export class BalanceItemDetailed extends BalanceItem {
    @field({ decoder: RegistrationWithMember, nullable: true })
    registration: RegistrationWithMember | null = null

    @field({ decoder: Order, nullable: true })
    order: Order | null = null
}

export class BalanceItemPaymentDetailed extends BalanceItemPayment {
    @field({ decoder: BalanceItem })
    balanceItem: BalanceItem

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

    get unitPrice() {
        if (this.price < 0 && this.balanceItem.unitPrice > 0) {
            return -this.balanceItem.unitPrice
        }
        return this.balanceItem.unitPrice
    }

    /**
     * When displayed as a single item
     */
    get itemPrefix(): string {
        return this.balanceItem.itemPrefix
    }

    /**
     * When displayed as a single item
     */
    get itemTitle(): string {
        return this.balanceItem.itemTitle
    }

    /**
     * When displayed as a single item
     */
    get itemDescription() {
        return this.balanceItem.itemDescription
    }

    toString() {
        return Formatter.float(this.amount) + 'x ' + this.itemTitle + (this.itemDescription ? ' (' + this.itemDescription + ')' : '');
    }

}
