import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Company } from '../Company.js';
import { PaymentCustomer } from '../PaymentCustomer.js';
import { File } from '../files/File.js';
import { InvoicedBalanceItem } from './InvoicedBalanceItem.js';

export class Invoice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Set if the invoice number is official. This number is unique per seller
     */
    number: string | null;

    /**
     * Seller
     */
    organizationId: string;

    /**
     * Can be null if it is not linked to an organization.
     * This is only used to allow the payer to list their (incoming) invoices.
     *
     * In the future we could expand this with members, users, and/or orders
     */
    payingOrganizationId: string | null;

    /**
     * A point-in-time snapshot of the seller.
     * In case the address changes over time, or when an organization has multiple companies and some invoices
     */
    @field({ decoder: Company })
    seller: Company;

    /**
     * Payer
     */
    @field({ decoder: PaymentCustomer })
    customer: PaymentCustomer;

    @field({ decoder: InvoicedBalanceItem })
    items: InvoicedBalanceItem[] = [];

    /**
     * Stored so we can fetch all paid or unpaid invoices easily
     */
    totalPrice: number;

    /**
     * Cache to determine if an invoice is paid or not
     */
    pricePaid: number;

    @field({ decoder: StringDecoder, nullable: true })
    ipAddress: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    userAgent: string | null = null;

    /**
     * When it is an invoice for transaction fees related to a given stripe account. The stripe account id is stored here.
     */
    @field({ decoder: StringDecoder, nullable: true })
    stripeAccountId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    reference: string | null = null;

    @field({ decoder: File, nullable: true })
    pdf: File | null = null;

    @field({ decoder: File, nullable: true })
    xml: File | null = null;
}
