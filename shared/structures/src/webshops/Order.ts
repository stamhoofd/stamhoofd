import { AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Address } from '../Address';
import { Payment } from '../members/Payment';
import { PaymentMethod } from '../PaymentMethod';
import { Cart } from './Cart';
import { Customer } from './Customer';
import { AnyCheckoutMethodDecoder, CheckoutMethod, WebshopTimeSlot } from './WebshopMetaData';

export class OrderData extends AutoEncoder {
    @field({ decoder: WebshopTimeSlot, nullable: true })
    timeSlot: WebshopTimeSlot | null = null
    
    @field({ decoder: AnyCheckoutMethodDecoder, nullable: true })
    checkoutMethod: CheckoutMethod | null = null

    /**
     * Only needed for delivery
     */
    @field({ decoder: Address, nullable: true })
    address: Address | null = null

    @field({ decoder: Cart })
    cart: Cart = Cart.create({})

    /**
     * Only needed for delivery
     */
    @field({ decoder: Customer, version: 40, upgrade: () => Customer.create({}) })
    customer: Customer

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod
}


export class Order extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: IntegerDecoder, nullable: true })
    number: number | null

    @field({ decoder: OrderData })
    data: OrderData

    @field({ decoder: Payment, nullable: true })
    payment: Payment | null // no default to prevent errors

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: DateDecoder, nullable: true })
    validAt: Date | null = null

}

export class OrderResponse extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    paymentUrl: string | null = null

    @field({ decoder: Order })
    order: Order
}