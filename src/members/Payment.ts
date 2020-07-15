import { AutoEncoder, DateDecoder,EnumDecoder,field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';

import { PaymentMethod } from '../PaymentMethod';
import { PaymentStatus } from '../PaymentStatus';

export class Payment extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    method: PaymentMethod

    @field({ decoder: new EnumDecoder(PaymentStatus) })
    status: PaymentStatus

    @field({ decoder: IntegerDecoder })
    price: number

    @field({ decoder: StringDecoder, nullable: true })
    transferDescription: string | null = null

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: DateDecoder })
    updatedAt: Date
}