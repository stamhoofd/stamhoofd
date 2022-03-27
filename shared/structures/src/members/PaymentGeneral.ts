import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding'

import { PaymentMethod } from '../PaymentMethod'
import { PaymentStatus } from '../PaymentStatus'
import { User } from '../User'
import { Order } from '../webshops/Order'
import { EncryptedPaymentDetailed } from './EncryptedPaymentDetailed'
import { PaymentDetailed } from './PaymentDetailed'

export class EncryptedPaymentGeneral extends EncryptedPaymentDetailed {
    @field({ decoder: Order, nullable: true })
    order: Order | null = null
}

export class PaymentGeneral extends PaymentDetailed {
    @field({ decoder: Order, nullable: true })
    order: Order | null = null

    override matchQuery(query: string): boolean {
        if (
            super.matchQuery(query) ||
            this.order?.matchQuery(query)
        ) {
            return true;
        }
        return false;
    }

    getDetailsHTMLTable(): string {
        if (this.order) {
            return this.order.getHTMLTable()
        }
        return super.getDetailsHTMLTable()
    }
}

export class CreatePaymentGeneral extends AutoEncoder {
    /// Last selected payment method. Nullable if none has been selected
    @field({ decoder: new EnumDecoder(PaymentMethod) })
    method: PaymentMethod = PaymentMethod.Unknown

    @field({ decoder: new EnumDecoder(PaymentStatus) })
    status: PaymentStatus = PaymentStatus.Created

    @field({ decoder: IntegerDecoder })
    price = 0

    @field({ decoder: IntegerDecoder, nullable: true })
    freeContribution: number | null = null

    // Transfer description if paid via transfer
    @field({ decoder: StringDecoder, nullable: true })
    transferDescription: string | null = null

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null

    @field({ decoder: new ArrayDecoder(StringDecoder)})
    registrationIds: string[] = []

    @field({ decoder: StringDecoder, nullable: true })
    orderId: string | null = null
}