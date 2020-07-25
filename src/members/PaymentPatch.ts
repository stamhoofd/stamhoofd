import { AutoEncoder,EnumDecoder,field,StringDecoder } from '@simonbackx/simple-encoding';

import { PaymentStatus } from '../PaymentStatus';

export class PaymentPatch extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: new EnumDecoder(PaymentStatus) })
    status: PaymentStatus
}