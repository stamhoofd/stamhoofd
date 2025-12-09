import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Company } from '../Company.js';
import { PaymentCustomer } from '../PaymentCustomer.js';
import { File } from '../files/File.js';
import { InvoiceItem } from './InvoiceItem.js';
import { GenericBalance } from '../GenericBalance.js';

export enum TaxCategoryCode {
    StandardRate = 'S',
    VATReverseCharge = 'AE',
}

export class TaxSubtotal extends AutoEncoder {
    /**
     * VAT percentage
     */
    @field({ decoder: IntegerDecoder })
    percentage = 0;

    @field({ decoder: new EnumDecoder(TaxCategoryCode) })
    categoryCode: TaxCategoryCode = TaxCategoryCode.StandardRate;

    /**
     * Taxable amount
     */
    @field({ decoder: IntegerDecoder })
    taxableAmount = 0;

    /**
     * VAT = taxable amount * percentage / 100 - rounded to 2 decimals
     */
    @field({ decoder: IntegerDecoder })
    taxAmount: number = 0;
}

export class Invoice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Set if the invoice number is official. This number is unique per seller
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    number: number | null = null;

    /**
     * Seller
     */
    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null;

    /**
     * Can be null if it is not linked to an organization.
     * This is only used to allow the payer to list their (incoming) invoices.
     *
     * In the future we could expand this with members, users, and/or orders
     */
    @field({ decoder: StringDecoder, nullable: true })
    payingOrganizationId: string | null = null;

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

    @field({ decoder: InvoiceItem })
    items: InvoiceItem[] = [];

    /**
     * Total price exluding VAT (does not need to be rounded because we already round per item)
     */
    @field({ decoder: IntegerDecoder })
    priceWithoutVAT: number = 0;

    /**
     * Total price including VAT (= priceWithoutVAT + VATAmounts)
     */
    @field({ decoder: IntegerDecoder })
    priceWithVAT: number = 0;

    /**
     * Total VAT per VAT percentage
     */
    @field({ decoder: new ArrayDecoder(TaxSubtotal) })
    VATTotal: TaxSubtotal[] = [];

    /**
     * The total balance that has been charged for this invoice.
     * The total balance should match the priceWithVAT, and can be used to know how much has been paid for the invoice.
     */
    @field({ decoder: new ArrayDecoder(GenericBalance) })
    balances: GenericBalance[] = [];

    /**
     * When it is an invoice for transaction fees related to a given stripe account. The stripe account id is stored here.
     */
    @field({ decoder: StringDecoder, nullable: true })
    stripeAccountId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    reference: string | null = null;

    /**
     * If this invoice has been credited, this contains the credited invoice (avoids duplicate crediting and some automatisation in case of chargebacks)
     */
    @field({ decoder: StringDecoder, nullable: true })
    negativeInvoiceId: string | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    didSendPeppol = false;

    @field({ decoder: File, nullable: true })
    pdf: File | null = null;

    @field({ decoder: File, nullable: true })
    xml: File | null = null;

    /**
     * Official invoice date (set together with the number)
     */
    @field({ decoder: DateDecoder, nullable: true })
    date: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null;

    calculatePrices() {
        throw new Error('Not implemented yet');
    }
}
