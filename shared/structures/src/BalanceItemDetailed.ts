import { field } from "@simonbackx/simple-encoding"

import { BalanceItem, BalanceItemPayment } from "./BalanceItem"
import { RegistrationWithMember } from "./members/RegistrationWithMember"
import { Order } from "./webshops/Order"

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
}
