import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { Payment, PrivatePayment } from "./members/Payment";

export enum BalanceItemStatus {
    /**
     * The balance is not yet owed by the member (payment is optional and not visible). But it is paid, the status will change to 'paid'.
     */
    Hidden = "Hidden",

    /**
     * The balance is owed by the member, but not yet (fully) paid by the member.
     */
    Pending = "Pending",

    /**
     * The balance has been paid by the member. All settled.
     */
    Paid = "Paid"
}

export enum BalanceItemType {
    "Registration" = "Registration",
    "AdministrationFee" = "AdministrationFee",
    "FreeContribution" = "FreeContribution",
    "Order" = "Order", 
    "Other" = "Other", 
}

export enum BalanceItemRelationType {
    "Webshop" = "Webshop", // Contains the name of the webshop 
    "Group" = "Group", // Contains the name of the group you registered for
    "GroupPrice" = "GroupPrice", // Contains the price of the group you registered for
    "GroupOptionMenu" = "GroupOptionMenu", // Contains the option menu that was chosen for the group
    "GroupOption" = "GroupOption", // Contains the option that was chosen for the group
    "Member" = "Member", // Contains the name of the member you registered
}

/**
 * Helps you understand what a balance item is for. It can be for multiple things at the same time, e.g. when it is an option to buy a ticket, it is also a ticket.
 */
export class BalanceItemRelation extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    name = ''
}

export class BalanceItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: new EnumDecoder(BalanceItemType), version: 307 })
    type = BalanceItemType.Other

    @field({ decoder: new MapDecoder(new EnumDecoder(BalanceItemRelationType), BalanceItemRelation), version: 307 })
    relations: Map<BalanceItemRelationType, BalanceItemRelation> = new Map()

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: IntegerDecoder, version: 307 })
    amount = 1

    @field({ decoder: IntegerDecoder, field: 'price' })
    @field({ decoder: IntegerDecoder, field: 'unitPrice', version: 307 })
    unitPrice = 0 // unit price

    get price() {
        return this.unitPrice * this.amount;
    }

    @field({ decoder: IntegerDecoder })
    pricePaid = 0

    @field({ decoder: DateDecoder })
    createdAt = new Date()

    @field({ decoder: new EnumDecoder(BalanceItemStatus) })
    status: BalanceItemStatus = BalanceItemStatus.Pending

    get isPaid() {
        return this.pricePaid === this.price;
    }

    @field({ decoder: StringDecoder, nullable: true })
    memberId: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    userId: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    registrationId: string | null = null
}

export class BalanceItemPayment extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: IntegerDecoder })
    price: number
}

export class BalanceItemPaymentWithPayment extends BalanceItemPayment {
    @field({ decoder: Payment })
    payment: Payment
}

export class BalanceItemPaymentWithPrivatePayment extends BalanceItemPayment {
    @field({ decoder: PrivatePayment })
    payment: PrivatePayment
}

export class BalanceItemWithPayments extends BalanceItem {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentWithPayment) })
    payments: BalanceItemPaymentWithPayment[] = []

    updatePricePaid() {
        this.pricePaid = this.payments.reduce((total, payment) => total + (payment.payment.isSucceeded ? payment.price : 0), 0);
    }

    /**
     * Return whether a payment has been initiated for this balance item
     */
    get hasPendingPayment() {
        return !!this.payments.find(p => p.payment.isPending)
    }

    static getOutstandingBalance(items: BalanceItemWithPayments[]) {
        // Get sum of balance payments
        const totalPending = items.flatMap(b => b.payments).filter(p => p.payment.isPending).map(p => p.price).reduce((t, total) => total + t, 0)

        const total = items.map(p => p.price - p.pricePaid).reduce((t, total) => total + t, 0)
        const totalOpen = total - totalPending;

        return {
            totalPending, // Pending payment
            totalOpen, // Not yet started
            total: totalPending + totalOpen // total not yet paid
        }
    }
}

export class BalanceItemWithPrivatePayments extends BalanceItemWithPayments {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentWithPrivatePayment) })
    payments: BalanceItemPaymentWithPrivatePayment[] = []
}
