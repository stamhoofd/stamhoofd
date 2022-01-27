import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { Payment, PrivatePayment } from '../members/Payment';
import { PaymentMethod } from '../PaymentMethod';
import { Checkout } from './Checkout';
import { Customer } from './Customer';

export enum OrderStatusV103 {
    Created = "Created",
    Prepared = "Prepared",
    Completed = "Completed",
    Canceled = "Canceled",
}

export enum OrderStatusV137 {
    Created = "Created",
    Prepared = "Prepared",
    Collect = "Collect",
    Completed = "Completed",
    Canceled = "Canceled",
}

export enum OrderStatus {
    Created = "Created",
    Prepared = "Prepared",
    Collect = "Collect",
    Completed = "Completed",
    Canceled = "Canceled",
    Deleted = "Deleted",
}

export class OrderStatusHelper {
    static getName(status: OrderStatus): string {
        switch (status) {
            case OrderStatus.Created: return "Nieuw"
            case OrderStatus.Prepared: return "Verwerkt"
            case OrderStatus.Collect: return "Ligt klaar"
            case OrderStatus.Completed: return "Voltooid"
            case OrderStatus.Canceled: return "Geannuleerd"
            case OrderStatus.Deleted: return "Verwijderd"
        }
    }

    static getColor(status: OrderStatus): string {
        switch (status) {
            case OrderStatus.Completed: return "success"
            case OrderStatus.Prepared: return "secundary"
            case OrderStatus.Collect: return "tertiary"
            case OrderStatus.Canceled: return "error"
            case OrderStatus.Created: return "info"
        }
        return "error"
    }
}

export class OrderData extends Checkout {
    @field({ decoder: StringDecoder, version: 129 })
    consumerLanguage = "nl"

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

    get shouldSendPaymentUpdates() {
        return (!this.timeSlot || (this.timeSlot.date.getTime() + 1000*60*60*24) > new Date().getTime())
    }

    /**
     * Delete the personal data associated with an order when you delete an order.
     * We still need the other data (e.g. to inform other clients about a deleted order)
     * And also to match online payments and handle refunds if needed
     */
    removePersonalData() {
        // Clear customer data
        this.customer = Customer.create({})

        // Clear free inputs
        this.fieldAnswers = []

        for (const item of this.cart.items) {
            item.fieldAnswers = []
        }
    }
}


export class Order extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder, version: 140 })
    webshopId: string

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
        decoder: new EnumDecoder(OrderStatusV137), 
        version: 104, 
        upgrade: (old: OrderStatusV103): OrderStatusV137 => {
            return old as any as OrderStatusV137
        }, 
        downgrade: (n: OrderStatusV137): OrderStatusV103 => {
            if (n === OrderStatusV137.Collect) {
                // Map to other status
                return OrderStatusV103.Prepared
            }
            return n as any as OrderStatusV103
        } 
    })
    @field({ 
        decoder: new EnumDecoder(OrderStatus), 
        version: 138, 
        upgrade: (old: OrderStatusV137): OrderStatus => {
            return old as any as OrderStatus
        }, 
        downgrade: (n: OrderStatus): OrderStatusV137 => {
            if (n === OrderStatus.Deleted) {
                // Map to other status
                return OrderStatusV137.Canceled
            }
            return n as any as OrderStatusV137
        } 
    })
    status: OrderStatus

    get shouldIncludeStock() {
        return this.status !== OrderStatus.Canceled && this.status !== OrderStatus.Deleted
    }

    matchQuery(query: string): boolean {
        if (this.number+"" == query) {
            return true
        }
        if (this.payment?.matchQuery(query)) {
            return true
        }
        return this.data.matchQuery(query)
    }

    getHTMLTable(): string {
        let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><thead><tr><th>Artikel</th><th>Prijs</th></tr></thead><tbody>`
        
        for (const item of this.data.cart.items) {
            str += `<tr><td><h4>${item.amount} x ${Formatter.escapeHtml(item.product.name)}</h4>${item.description.length > 0 ? "<p>"+Formatter.escapeHtml(item.description)+"</p>" : ""}</td><td>${Formatter.escapeHtml(Formatter.price(item.getPrice(this.data.cart)))}</td></tr>`
        }
        
        return str+"</tbody></table>";
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
