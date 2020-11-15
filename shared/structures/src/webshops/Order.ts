import { AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Payment } from '../members/Payment';
import { PaymentMethod } from '../PaymentMethod';
import { Checkout } from './Checkout';

export class OrderData extends Checkout {
    // Payment method is required
    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod

    matchQuery(query: string): boolean {
        const lowerQuery = query.toLowerCase();
        if (
            this.customer.firstName.toLowerCase().includes(lowerQuery) ||
            this.customer.lastName.toLowerCase().includes(lowerQuery) ||
            this.customer.name.toLowerCase().includes(lowerQuery)
        ) {
            return true;
        }

        // Search product names
        for (const item of this.cart.items) {
            if (
                item.product.name.toLowerCase().includes(lowerQuery)
            ) {
                return true;
            }
        }
        return false;
    }
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