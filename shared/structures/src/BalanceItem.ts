import { ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { Member } from "./members/Member";
import { Payment } from "./members/Payment";
import { Registration } from "./members/Registration";
import { RegistrationWithMember } from "./members/RegistrationWithMember";
import { PaymentStatus } from "./PaymentStatus";
import { Order } from "./webshops/Order";

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

export class BalanceItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: IntegerDecoder })
    price = 0

    @field({ decoder: IntegerDecoder })
    pricePaid = 0

    @field({ decoder: DateDecoder })
    createdAt = new Date()

    get isPaid() {
        return this.pricePaid === this.price;
    }
}

export class BalanceItemPayment extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: IntegerDecoder })
    price: number
}

export class BalanceItemDetailed extends BalanceItem {
    @field({ decoder: Registration, nullable: true })
    registration: Registration | null = null

    @field({ decoder: Member, nullable: true })
    member: Member | null = null

    @field({ decoder: Order, nullable: true })
    order: Order | null = null
}

export class BalanceItemPaymentDetailed extends BalanceItemPayment {
    @field({ decoder: BalanceItemDetailed })
    balanceItem: BalanceItemDetailed
}

//
export class MemberBalanceItemPayment extends BalanceItemPayment {
    @field({ decoder: Payment })
    payment: Payment
}

export class MemberBalanceItem extends BalanceItem {
    @field({ decoder: new ArrayDecoder(MemberBalanceItemPayment) })
    payments: MemberBalanceItemPayment[] = []

    @field({ decoder: StringDecoder, nullable: true })
    memberId: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    userId: string | null = null

    @field({ decoder: Registration, nullable: true })
    registration: Registration | null = null

    @field({ decoder: Order, nullable: true })
    order: Order | null = null

    /**
     * Return whether a payment has been initiated for this balance item
     */
    get hasPendingPayment() {
        return !!this.payments.find(p => p.payment.isPending)
    }

    static getOutstandingBalance(items: MemberBalanceItem[]) {
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