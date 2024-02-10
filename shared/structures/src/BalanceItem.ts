import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
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

    @field({ decoder: new EnumDecoder(BalanceItemStatus) })
    status: BalanceItemStatus = BalanceItemStatus.Pending

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

export class MemberBalanceItemPayment extends BalanceItemPayment {
    @field({ decoder: Payment })
    payment: Payment
}

export class BalanceItemPaymentWithPrivatePayment extends BalanceItemPayment {
    @field({ decoder: PrivatePayment })
    payment: PrivatePayment
}

export class BalanceItemWithPayments extends BalanceItem {
    @field({ decoder: new ArrayDecoder(MemberBalanceItemPayment) })
    payments: MemberBalanceItemPayment[] = []

    updatePricePaid() {
        this.pricePaid = this.payments.reduce((total, payment) => total + (payment.payment.isSucceeded ? payment.price : 0), 0);
    }
}

export class BalanceItemWithPrivatePayments extends BalanceItem {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentWithPrivatePayment) })
    payments: BalanceItemPaymentWithPrivatePayment[] = []

    updatePricePaid() {
        this.pricePaid = this.payments.reduce((total, payment) => total + (payment.payment.isSucceeded ? payment.price : 0), 0);
    } 
}