import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';

import { Address } from '../Address';
import { PaymentMethod } from '../PaymentMethod';
import { Cart } from './Cart';
import { Customer } from './Customer';
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

    /**
     * Only needed for delivery
     */
    @field({ decoder: Customer, version: 40 })
    customer: Customer = Customer.create({})

    @field({ decoder: Cart })
    cart: Cart = Cart.create({})

    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null
}