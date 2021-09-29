import { AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Payment, PrivatePayment } from '../members/Payment';
import { PaymentMethod } from '../PaymentMethod';
import { Checkout } from './Checkout';

export enum OrderStatusV103 {
    Created = "Created",
    Prepared = "Prepared",
    Completed = "Completed",
    Canceled = "Canceled",
}

export enum OrderStatus {
    Created = "Created",
    Prepared = "Prepared",
    Collect = "Collect",
    Completed = "Completed",
    Canceled = "Canceled",
}

export class OrderStatusHelper {
    static getName(status: OrderStatus): string {
        switch (status) {
            case OrderStatus.Created: return "Nieuw"
            case OrderStatus.Prepared: return "Verwerkt"
            case OrderStatus.Collect: return "Ligt klaar"
            case OrderStatus.Completed: return "Voltooid"
            case OrderStatus.Canceled: return "Geannuleerd"
        }
    }
}

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

    @field({ decoder: DateDecoder, version: 107 })
    updatedAt: Date

    @field({ decoder: DateDecoder, nullable: true })
    validAt: Date | null = null

    @field({ decoder: new EnumDecoder(OrderStatusV103), version: 47 })
    // Migrate newer order status .collect in case of older client
    @field({ 
        decoder: new EnumDecoder(OrderStatus), 
        version: 104, 
        upgrade: (old: OrderStatusV103): OrderStatus => {
            return old as any as OrderStatus
        }, 
        downgrade: (n: OrderStatus): OrderStatusV103 => {
            if (n === OrderStatus.Collect) {
                // Map to other status
                return OrderStatusV103.Prepared
            }
            return n as any as OrderStatusV103
        } 
    })
    status: OrderStatus

    get shouldIncludeStock() {
        return this.status !== OrderStatus.Canceled
    }
}

export class PrivateOrder extends Order {
    @field({ decoder: PrivatePayment, nullable: true })
    payment: PrivatePayment | null
    
}

export class OrderResponse extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    paymentUrl: string | null = null

    @field({ decoder: Order })
    order: Order
}
