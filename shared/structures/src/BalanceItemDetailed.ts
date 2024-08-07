import { ArrayDecoder, field, StringDecoder } from "@simonbackx/simple-encoding"

import { BalanceItem, BalanceItemPayment, MemberBalanceItemPayment } from "./BalanceItem"
import { Registration } from "./members/Registration"
import { RegistrationWithMember } from "./members/RegistrationWithMember"
import { Order } from "./webshops/Order"

export class BalanceItemDetailed extends BalanceItem {
    @field({ decoder: RegistrationWithMember, nullable: true })
    registration: RegistrationWithMember | null = null

    @field({ decoder: Order, nullable: true })
    order: Order | null = null
}

export class BalanceItemPaymentDetailed extends BalanceItemPayment {
    @field({ decoder: BalanceItemDetailed })
    balanceItem: BalanceItemDetailed
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
