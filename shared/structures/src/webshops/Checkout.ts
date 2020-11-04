import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { Address } from '../Address';
import { AnyCheckoutMethodDecoder, CheckoutMethod, WebshopTimeSlot } from './WebshopMetaData';

export class Checkout extends AutoEncoder {
    @field({ decoder: WebshopTimeSlot, nullable: true })
    timeSlot: WebshopTimeSlot | null = null
    
    @field({ decoder: AnyCheckoutMethodDecoder, nullable: true })
    checkoutMethod: CheckoutMethod | null = null

    /**
     * Only needed for delivery
     */
    @field({ decoder: Address, nullable: true })
    address: Address | null = null

}