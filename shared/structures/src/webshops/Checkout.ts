import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { AnyCheckoutMethod, AnyCheckoutMethodDecoder, WebshopTimeSlot } from './WebshopMetaData';

export class Checkout extends AutoEncoder {
    @field({ decoder: WebshopTimeSlot, nullable: true })
    timeSlot: WebshopTimeSlot | null = null
    
    @field({ decoder: AnyCheckoutMethodDecoder, nullable: true })
    checkoutMethod: AnyCheckoutMethod | null = null

}