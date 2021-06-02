import { AutoEncoder,EnumDecoder,field,IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';

import { PaymentStatus } from '../PaymentStatus';

export class PaymentPatch extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: new EnumDecoder(PaymentStatus), optional: true })
    status?: PaymentStatus

    @field({ decoder: IntegerDecoder, optional: true })
    price?: number
}