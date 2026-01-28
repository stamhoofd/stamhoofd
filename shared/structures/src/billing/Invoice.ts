import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItem, getVATExcemptReasonName, VATExcemptReason } from '../BalanceItem.js';
import { Company } from '../Company.js';
import { PaymentCustomer } from '../PaymentCustomer.js';
import { PriceBreakdown } from '../PriceBreakdown.js';
import { File } from '../files/File.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { InvoicedBalanceItem } from './InvoicedBalanceItem.js';
import { Sorter, STMath } from '@stamhoofd/utility';

export class VATSubtotal extends AutoEncoder {
    /**
     * For tax ecempt items, this should be zero but it is ignored anyway
     */
    @field({ decoder: IntegerDecoder })
    VATPercentage: number = 0;

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

export enum InvoiceType {
    Invoice = 'Invoice',
    CreditNote = 'CreditNote',
}

export class InvoiceTypeHelper {
    static getName(type: InvoiceType): string {
        switch (type) {
            case InvoiceType.Invoice: return $t('fbf8fca6-33f0-4ecc-8317-0033f256827e');
            case InvoiceType.CreditNote: return $t('4578aaf4-a15a-4c53-ad46-768b91d96a4e');
        }
    }
}

export class Invoice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Set if the invoice number is official. This number is unique per seller
     */
    @field({ decoder: StringDecoder, nullable: true })
    number: string | null = null;

    /**
     * Seller
     */
    @field({ decoder: StringDecoder })
    organizationId: string;

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
    @field({ decoder: Company, defaultValue: () => Company.create({}) })
    seller: Company;

    /**
     * Payer
     */
    @field({ decoder: PaymentCustomer, defaultValue: () => PaymentCustomer.create({}) })
    customer: PaymentCustomer;

    /**
     * The balance items that are invoiced, with their original price. This does not always correspond to the total price of the invoice, or the item prices on the invoice because prices are converted to prices excluding VAT and with PEPPOL rounding rules.
     */
    @field({ decoder: new ArrayDecoder(InvoicedBalanceItem) })
    items: InvoicedBalanceItem[] = [];

    /**
     * The total sum of an invoice should always match the total sum of the payments connected to it.
     * On top of that, the amounts related to each balance item in the payments, should match the invoiced balance amount in each item in the invoice.
     *
     * Note, that this is a limitation. A payment can only be related to a single invoice. But an invoice can be for multiple payments.
     * More flexibility is often unneeded and makes reconciliation unnecessary complex.
     */
    @field({ decoder: new ArrayDecoder(PaymentGeneral) })
    payments: PaymentGeneral[] = [];

    get totalWithoutVAT() {
        return this.items.reduce((sum, item) => sum + item.totalWithoutVAT, 0);
    }

    get totalBalanceInvoicedAmount() {
        return this.items.reduce((sum, item) => sum + item.balanceInvoicedAmount, 0);
    }

    get totalPaymentsAmount() {
        return this.payments.reduce((sum, item) => sum + item.price, 0);
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
     *
     * Best viewed as a virtual extra balance item linked to the invoice to compensate.
     *
     * This is used to explain and report why there is a difference between the sum of the balance item's prices and the actually invoiced price, comparable with roundingAmount on payments.
     * - Say we invoice 3 items of 0,242 euro. The sum would be 0,726. The invoice total price might be 0,73 because of rounding rules. Then the balanceRoundingAmount would be 0,004.
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

    @field({ decoder: StringDecoder, nullable: true })
    negativeInvoiceId: string | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    didSendPeppol = false;

    @field({ decoder: DateDecoder, nullable: true })
    invoicedAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    dueAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    validateVATRates() {
        let intra = false;
        if (this.customer.company && this.customer.company.VATNumber && this.customer.company.address) {
            if (this.seller.VATNumber && this.seller.address) {
                // Reverse charged vat applicable?
                if (this.customer.company.address.country !== this.seller.address.country) {
                    intra = true;
                }
            }
        }

        if (intra) {
            for (const item of this.items) {
                if (item.VATExcempt !== VATExcemptReason.IntraCommunity) {
                    throw new SimpleError({
                        code: 'missing_vat_excemption',
                        message: 'Missing IntraCommunity VAT excemption',
                        human: $t('8b562a1d-e7c0-4110-b320-db535f0ea0e9'),
                    });
                }
            }
        }
        else {
            for (const item of this.items) {
                if (item.VATExcempt === VATExcemptReason.IntraCommunity) {
                    throw new SimpleError({
                        code: 'erroneous_vat_excemption',
                        message: 'IntraCommunity VAT excemption should not apply to this item',
                        human: $t('d2c3f57f-ffae-45ea-97ce-3f4f30839cd6'),
                    });
                }
            }
        }
    }

    calculateVAT() {
        // For every VAT category, calculate the taxable amount and VAT amount
        this.VATTotal = InvoicedBalanceItem.groupPerVATCategory(this.items).map((items) => {
            const category = new VATSubtotal();
            category.VATPercentage = items[0].VATExcempt === null ? items[0].VATPercentage : 0;
            category.VATExcempt = items[0].VATExcempt;
            category.taxablePrice = items.reduce((a, b) => a + b.totalWithoutVAT, 0);

            if (!category.VATExcempt) {
                category.VAT = STMath.round(category.taxablePrice * category.VATPercentage / 100_00) * 100;
            }
            else {
                category.VAT = 0;
            }
            return category;
        });
    }

    addItem(item: InvoicedBalanceItem) {
        this.items.push(item);
        this.calculateVAT();
    }

    get type() {
        if (this.totalWithVAT < 0) {
            return InvoiceType.CreditNote;
        }
        return InvoiceType.Invoice;
    }

    get theme() {
        if (this.type === InvoiceType.CreditNote) {
            return 'theme-error';
        }
    }

    get priceBreakdown(): PriceBreakdown {
        return [
            {
                name: $t(`d642f190-1607-4f54-8530-7af2f15c651b`),
                price: this.totalWithoutVAT,
            },
            {
                name: $t(`13c04b8f-80f5-4274-9ea1-badb0f88a091`),
                price: this.VATTotalAmount,
            },
            ...(this.payableRoundingAmount !== 0
                ? [
                        {
                            name: $t(`dafd5091-0698-4117-bc5a-db8ba05cefcd`),
                            price: this.payableRoundingAmount,
                        },
                    ]
                : []),
            {
                name: $t(`0376551a-9af8-44b7-8ab3-d343384dc900`),
                price: this.totalWithVAT,
            },
        ];
    }

    updatePayableRoundingAmount() {
        // Calculate difference between the invoice price and the payments price
        const difference = this.totalPaymentsAmount - (this.totalWithVAT - this.payableRoundingAmount);
        if (Math.abs(difference) < 5_00) { // Correct maximum 5 cents
            this.payableRoundingAmount = difference;
        }
        else {
            this.payableRoundingAmount = 0;
        }
    }

    /** */
    correctRoundingByUpdatingPrices() {
        console.log('correctRoundingByUpdatingPrices');

        const difference = this.totalPaymentsAmount - (this.totalWithVAT - this.payableRoundingAmount);
        if (difference === 0) {
            // No need to do any magic
            return;
        }

        // For each VAT group, we start with the expected total without VAT.
        // We calculate the difference and try to correct for it within the same VAT group.
        // We first try to apply extra cents (or removal of cents) to the items with the highest difference
        for (const items of InvoicedBalanceItem.groupPerVATCategory(this.items)) {
            console.log('Calculating for group', items);
            const current = items.reduce((a, b) => a + b.totalWithoutVAT, 0);
            const precise = items.reduce((a, b) => a + b.preciseTotalWithoutVAT, 0);

            const toAddToTaxablePrice = STMath.round((precise - current) / 100) * 100;

            console.log('toAddToTaxablePrice', toAddToTaxablePrice);

            if (toAddToTaxablePrice === 0) {
                // Less than 1 cent difference, we cannot apply this
                continue;
            }

            // If toAddToTaxablePrice > 0 -> te weinig aangerekend - difference moet worden toegevoegd aan taxableprice
            // If toAddToTaxablePrice < 0 -> te veel aangerekend - difference moet worden toegevoegd aan taxableprice

            function getNext() {
                // Rank items by difference
                items.sort((a, b) => {
                    const aDiff = a.preciseTotalWithoutVAT - a.totalWithoutVAT;
                    const bDiff = b.preciseTotalWithoutVAT - b.totalWithoutVAT;

                    if (toAddToTaxablePrice < 0) {
                        // We need to subtract, so sort ascending (largest negative items first)
                        return aDiff - bDiff;
                    }
                    return bDiff - aDiff; // Sort descending
                });

                const next = items[0];
                if (!next) {
                    return;
                }
                return next;
            }

            let next = getNext();
            let loops = 0;
            while (next && loops < 100) {
                loops++;
                const current = items.reduce((a, b) => a + b.totalWithoutVAT, 0);
                const currentToAddToTaxablePrice = STMath.round((precise - current) / 100) * 100;
                if (currentToAddToTaxablePrice === 0 || Math.sign(currentToAddToTaxablePrice) !== Math.sign(toAddToTaxablePrice)) {
                    console.log('Stopped group calculation because currentToAddToTaxablePrice is zero or switched sign', currentToAddToTaxablePrice);
                    break;
                }

                // Change prices in steps of 0.005 (total price, so divided by quantity)
                let step = Math.round(50 * 1_00_00 / Math.abs(next.quantity));
                if (step <= 1) {
                    step = 1; // Might jump further than expected / wanted
                }
                const addition = Math.sign(currentToAddToTaxablePrice) * Math.sign(next.quantity) * step;
                next.unitPrice += addition;
                next.addedToUnitPriceToCorrectVAT += addition;
                console.log('Increasing unit price of ', next, 'with ' + addition);

                // todo
                next = getNext();
            }

            console.log('Done calculating group');
        }
        console.log('Done correctRoundingByUpdatingPrices');
    }

    /**
     * Call this method after changing the payments related to an invoice.
     */
    buildFromPayments() {
        if (this.number) {
            throw new SimpleError({
                code: 'invoice_has_number',
                message: 'An invoice is immutable after it has been generated',
            });
        }

        // Keep the sum of all balance items.
        const balanceItemsMap: Map<string, { balanceItem: BalanceItem; amount: number }> = new Map();

        for (const payment of this.payments) {
            for (const item of payment.balanceItemPayments) {
                let data = balanceItemsMap.get(item.balanceItem.id);
                if (!data) {
                    data = {
                        balanceItem: item.balanceItem,
                        amount: 0,
                    };
                    balanceItemsMap.set(item.balanceItem.id, data);
                }
                data.amount += item.price;
            }
        }

        const invoicedItems: InvoicedBalanceItem[] = [];

        for (const item of balanceItemsMap.values()) {
            const invoiced = InvoicedBalanceItem.createFor(item.balanceItem, item.amount);
            invoicedItems.push(invoiced);
        }

        invoicedItems.sort((a, b) => {
            return Sorter.stack(
                Sorter.byNumberValue(a.totalWithoutVAT, b.totalWithoutVAT),
                Sorter.byStringValue(a.name || a.description, b.name || b.description),
            );
        });

        this.items = invoicedItems;
        this.correctRoundingByUpdatingPrices();
        this.calculateVAT();
        this.updatePayableRoundingAmount();

        if (this.totalWithVAT !== this.totalPaymentsAmount) {
            throw new SimpleError({
                code: 'price_difference',
                message: 'The price of the generated invoice did not match the price of the corresponding payments. Possibly caused by rounding that could not be corrected automatically.',
                human: $t('Het is niet mogelijk om een factuur aan te maken. Er zit een onverwachts verschil tussen de prijs van de aan te maken factuur en het te betalen bedrag.'),
            });
        }
    }
}
