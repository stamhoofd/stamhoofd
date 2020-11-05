import { AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { Address } from '../Address';
import { Payment } from '../members/Payment';
import { PaymentMethod } from '../PaymentMethod';
import { Cart } from './Cart';
import { AnyCheckoutMethodDecoder, CheckoutMethod, WebshopTimeSlot } from './WebshopMetaData';

export class OrderData extends AutoEncoder {
    @field({ decoder: WebshopTimeSlot, nullable: true })
    timeSlot: WebshopTimeSlot | null = null
    
    @field({ decoder: AnyCheckoutMethodDecoder })
    checkoutMethod: CheckoutMethod

    /**
     * Only needed for delivery
     */
    @field({ decoder: Address, nullable: true })
    address: Address | null = null

    @field({ decoder: Cart })
    cart: Cart = Cart.create({})

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod
}


export class Order extends AutoEncoder {
    @field({ decoder: OrderData })
    data: OrderData

    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null

}

export class OrderResponse extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    paymentUrl: string | null = null

    @field({ decoder: Order })
    order: Order
}