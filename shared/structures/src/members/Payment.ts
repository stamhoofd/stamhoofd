import { AutoEncoder, DateDecoder,EnumDecoder,field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { PaymentMethod } from '../PaymentMethod';
import { PaymentStatus } from '../PaymentStatus';

export class Payment extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    /// Last selected payment method. Nullable if none has been selected
    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    method: PaymentMethod | null = null

    @field({ decoder: new EnumDecoder(PaymentStatus) })
    status: PaymentStatus = PaymentStatus.Created

    @field({ decoder: IntegerDecoder })
    price: number

    // Transfer description if paid via transfer
    @field({ decoder: StringDecoder, nullable: true })
    transferDescription: string | null = null

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: DateDecoder })
    updatedAt: Date
}