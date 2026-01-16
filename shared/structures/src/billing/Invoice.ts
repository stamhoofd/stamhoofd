import { ArrayDecoder, AutoEncoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Company } from '../Company.js';
import { PaymentCustomer } from '../PaymentCustomer.js';
import { File } from '../files/File.js';
import { InvoicedBalanceItem } from './InvoicedBalanceItem.js';
import { VATExcemptReason } from '../BalanceItem.js';

export class VATSubtotal extends AutoEncoder {
    /**
     * In case this is null, VATExcempt should be set to explain why there is no VAT
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    VATPercentage: number | null = null;

    @field({ decoder: new EnumDecoder(VATExcemptReason), nullable: true })
    VATExcempt: VATExcemptReason | null = null;

    /**
     * Value on which the VAT is calculated (taxable amount)
     */
    @field({ decoder: IntegerDecoder })
    taxablePrice: number = 0;

    @field({ decoder: IntegerDecoder })
    VAT: number = 0;
}

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

    /**
     * The balance items that are invoiced, with their original price. This does not always correspond to the total price of the invoice, or the item prices on the invoice because prices are converted to prices excluding VAT and with PEPPOL rounding rules.
     */
    @field({ decoder: new ArrayDecoder(InvoicedBalanceItem) })
    items: InvoicedBalanceItem[] = [];

    get totalWithoutVAT() {
        return this.items.reduce((sum, item) => sum + item.totalWithoutVAT, 0);
    }

    get totalBalanceInvoicedAmount() {
        return this.items.reduce((sum, item) => sum + item.balanceInvoicedAmount, 0);
    }

    /**
     * This is the rounding amount in cents that is applied to the normal calculation of the invoiced balance items (prices exluding VAT) to come to the actual total price of the invoice.
     *
     * This is visible on the invoice. It is use to correct for differences between the paid price and the calculated invoice price because of rounding issues or things that can't be represented properly in PEPPOL due to rounding
     *
     * - Say we invoice 31 items of 5 euro including VAT, so 4,13 euro excluding VAT. This means InvoicedBalanceItem has
     *      - balanceInvoicedAmount = 5 euro
     *      - amount = 31_00_00 (31 pieces)
     *      - unitPrice = 4_13_00 (4,13 euro excluding VAT, rounded to 1 cent because of PEPPOL)
     *   The normal invoiced sum would be 155 euro if we sum balanceInvoicedAmount
     *   But the invoice total price will be 128,03 excluding VAT, and 154,92 euro including VAT because of rounding rules (round on total level, not individual item level).
     *   In this case payableRoundingAmount would be 0,08 euro, because that is the price that needs to be added to the normal calculation to come to the actual invoice total price that needs to be paid (155 euro).
     *   A different solution might be to increase the price excluding VAT of some items by 0,07 euro (or add an extra item on the invoice with the same VAT rate), so the total excluding VAT becomes 128,10 euro, and including VAT 155 euro. This is not always possible though, in some cases we maintain a difference of 1 cent.
     *   balanceRoundingAmount would be 0 because there is no difference lower than 1 cent.
     */
    @field({ decoder: IntegerDecoder })
    payableRoundingAmount: number = 0;

    /**
     * The difference between the totalWithVAT of the invoice and the sum of all balanceInvoicedAmount of the invoiced balance items.
     * totalBalanceInvoicedAmount + balanceRoundingAmount = totalWithVAT
     * This is used to explain and report why there is a difference between the sum of the balance item's prices and the actually invoiced price, comparable with roundingAmount on payments.
     * - Say we invoice 3 items of 0,242 euro. The sum would be 0,726. The invoice total price might be 0,73 because of rounding rules. Then the balanceRoundingAmount would be -0,004.
     */
    get balanceRoundingAmount() {
        return this.totalWithVAT - this.totalBalanceInvoicedAmount;
    }

    /**
     * List of VAT per VAT rate or category. This is stored in case the calculation changes over time.
     */
    @field({ decoder: new ArrayDecoder(VATSubtotal) })
    VATTotal: VATSubtotal[] = [];

    get VATTotalAmount() {
        return this.VATTotal.reduce((sum, item) => sum + item.VAT, 0);
    }

    /**
     * Total invoiced price, including VAT
     * This should equal the sum of:
     * - all InvoicedBalanceItem.totalWithoutVAT
     * - plus payableRoundingAmount
     * - plus VATTotalAmount
     */
    get totalWithVAT() {
        return this.totalWithoutVAT + this.VATTotalAmount + this.payableRoundingAmount;
    }

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

    calculateVAT() {
        // For every VAT category, calculate the taxable amount and VAT amount
        const categories = new Map<string, VATSubtotal>();
        for (const item of this.items) {
            let key: string;
            if (item.VATPercentage !== null) {
                key = `vat_${item.VATPercentage}`;
            }
            else {
                key = `excempt_${item.VATExcempt}`;
            }

            let category = categories.get(key);
            if (!category) {
                category = new VATSubtotal();
                category.VATPercentage = item.VATPercentage;
                category.VATExcempt = item.VATExcempt;
                categories.set(key, category);
            }

            category.taxablePrice += item.totalWithoutVAT;
        }

        // Calculate VAT amount for each category and round to 1 cent
        for (const category of categories.values()) {
            if (category.VATPercentage !== null) {
                category.VAT = Math.round(category.taxablePrice * category.VATPercentage / 100_00) * 100;
            }
            else {
                category.VAT = 0;
            }
        }

        this.VATTotal = Array.from(categories.values());
    }
}
