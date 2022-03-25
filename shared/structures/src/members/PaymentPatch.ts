import { AutoEncoder,DateDecoder,EnumDecoder,field,IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';

import { PaymentMethod } from '../PaymentMethod';
import { PaymentStatus } from '../PaymentStatus';
import { TransferSettings } from '../webshops/TransferSettings';

export class PaymentPatch extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: new EnumDecoder(PaymentStatus), optional: true })
    status?: PaymentStatus

    @field({ decoder: IntegerDecoder, optional: true })
    price?: number

    @field({ decoder: new EnumDecoder(PaymentMethod), optional: true })
    method?: PaymentMethod

    @field({ decoder: DateDecoder, nullable: true, optional: true })
    paidAt?: Date | null

    @field({ decoder: StringDecoder, nullable: true, optional: true  })
    transferDescription?: string | null

    @field({ decoder: TransferSettings, nullable: true, optional: true  })
    transferSettings?: TransferSettings | null
}