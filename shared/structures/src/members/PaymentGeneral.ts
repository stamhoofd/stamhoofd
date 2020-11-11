import { field } from '@simonbackx/simple-encoding'

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
}