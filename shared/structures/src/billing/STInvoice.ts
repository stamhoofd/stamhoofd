import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { Address } from '../addresses/Address.js';
import { File } from '../files/File.js';
import { Payment, Settlement } from '../members/Payment.js';
import { OrganizationSimple } from '../OrganizationSimple.js';
import { STPackage, STPricingType } from './STPackage.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export enum STInvoiceStatus {
    Created = 'Created',
    Prepared = 'Prepared',
    Completed = 'Completed',
    Canceled = 'Canceled',
}

/**
 * @deprecated use Invoice
 */
export class STInvoiceItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: IntegerDecoder })
    amount = 1;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    unitPrice = 0;

    @field({ decoder: BooleanDecoder, version: 155 })
    canUseCredits = true;

    @field({ decoder: DateDecoder, nullable: true, optional: true })
    firstFailedPayment: Date | null = null;

    @field({ decoder: IntegerDecoder, optional: true })
    paymentFailedCount = 0;

    get price(): number {
        return this.unitPrice * this.amount;
    }

    /**
     * All data of the original package that is linked to this item
     */
    @field({ decoder: STPackage, optional: true })
    package?: STPackage;

    /**
     * Date the item was created/bought
     */
    @field({ decoder: DateDecoder, optional: true })
    date?: Date;

    /**
     * Convertable into STInvoiceItem (or the diffence if amount is increased)
     * Use this to calculate prices or create an invoice
     * This will calculate the price to expand the package to the given amount.
     * If you want to renew a package, you need to create a new package first
     */
    static fromPackage(pack: STPackage, amount = 1, pendingAmount = 0, date?: Date): STInvoiceItem {
        let unitPrice = Math.round(pack.meta.unitPrice);

        if (amount < pack.meta.minimumAmount) {
            // Minimum should get applied first, because we might already have paid for the minimum (paid amount)
            amount = pack.meta.minimumAmount;
        }

        amount -= pendingAmount;
        amount -= pack.meta.paidAmount;
        if (amount <= 0) {
            amount = 0;
        }

        /// When pricing type is memebrs, the price is calculated per year.
        /// If a shorter period is remaining, we give a discount in order
        /// to no need to handle it more complicated
        let now = date ?? new Date();
        if (now < pack.meta.startDate) {
            // When creating a new package, we sometimes buy it for the future, so use that date instead of now
            now = pack.meta.startDate;
        }

        if (pack.validUntil && pack.meta.pricingType !== STPricingType.Fixed) {
            const totalDays = Math.round((pack.validUntil.getTime() - pack.meta.startDate.getTime()) / (1000 * 60 * 60 * 24));
            let remainingDays = Math.round((pack.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            /// First 3 months are full price
            const paidDays = 30 * 3;

            if (remainingDays > totalDays) {
                remainingDays = totalDays;
            }

            if (totalDays > 366) {
                // Increase unit price
                unitPrice = unitPrice * (totalDays / 365);
            }

            if (pack.meta.pricingType === STPricingType.PerMember) {
                unitPrice = Math.round(Math.min(unitPrice, unitPrice * remainingDays / (Math.max(365, totalDays) - paidDays)));
            }
            else {
                unitPrice = Math.round(unitPrice);
            }
        }

        const item = STInvoiceItem.create({
            name: pack.meta.name,
            description: pack.validUntil ? ('Van ' + Formatter.date(now, true) + ' tot ' + Formatter.date(pack.validUntil, true)) : ('Vanaf ' + Formatter.date(pack.meta.startDate, true)),
            package: pack,
            date: now,
            unitPrice: unitPrice,
            amount: amount,
        });

        return item;
    }

    canMerge(other: STInvoiceItem): boolean {
        // Mergeable if both don't have a packege, or both have the same package
        if (other.package && !this.package) {
            return false;
        }
        if (!other.package && this.package) {
            return false;
        }
        if (other.package && this.package && other.package.id !== this.package.id) {
            return false;
        }
        if (this.name === other.name && this.description === other.description) {
            if (this.unitPrice === other.unitPrice) {
                return true;
            }

            if (this.amount === 1 && other.amount === 1) {
                return true;
            }
        }
        return false;
    }

    merge(other: STInvoiceItem): void {
        if (other.paymentFailedCount > this.paymentFailedCount) {
            this.paymentFailedCount = other.paymentFailedCount;
        }
        if (other.firstFailedPayment && (!this.firstFailedPayment || other.firstFailedPayment < this.firstFailedPayment)) {
            this.firstFailedPayment = other.firstFailedPayment;
        }
        if (other.unitPrice !== this.unitPrice) {
            if (other.amount === 1 && this.amount === 1) {
                this.unitPrice += other.unitPrice;
                this.package = other.package;
                return;
            }
            throw new Error('Cannot merge items with different unit prices and amount greater than 1');
        }
        this.amount += other.amount;
    }

    /// Only compress an invoice when it is marked as paid and for a pending invoice when it doesn't has an invoice
    /// Else you'll lose the ID's!
    static compress(items: STInvoiceItem[]) {
        const copy = items.slice();

        for (let index = 0; index < copy.length; index++) {
            // Create a copy to prevent changing the original one
            const item = STInvoiceItem.create(copy[index]);
            copy[index] = item;

            // Loop further (in reverse order to be able to delete items)
            for (let j = copy.length - 1; j > index; j--) {
                const other = copy[j];
                if (item.canMerge(other)) {
                    // Delete other
                    item.merge(other);
                    copy.splice(j, 1);
                }
            }
        }
        return copy;
    }
}

/**
 * @deprecated use Invoice
 */
export class STInvoiceMeta extends AutoEncoder {
    /**
     * Date the invoice was valid and given a number.
     */
    @field({ decoder: DateDecoder, optional: true })
    date?: Date;

    /**
     * Only set if the invoice is officially generated and send
     */
    @field({ decoder: File, optional: true })
    pdf?: File;

    /**
     * Only set if the invoice is officially generated and send + company has VAT number
     */
    @field({ decoder: File, optional: true })
    xml?: File;

    /**
     * VATPercentage should be zero in countries outside Belgium in EU
     */
    @field({ decoder: IntegerDecoder })
    VATPercentage = 21;

    @field({ decoder: new ArrayDecoder(STInvoiceItem) })
    items: STInvoiceItem[] = [];

    /**
     * Sometimes we need to calculate an invoice in reverse when we have a fixed price including VAT,
     * but need to calculatle the price excluding VAT.
     */
    @field({ decoder: BooleanDecoder, version: 186 })
    areItemsIncludingVAT = false;

    // Cached company information (in case it is changed)
    @field({ decoder: StringDecoder })
    companyName: string;

    @field({ decoder: StringDecoder })
    companyContact: string;

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    companyEmail: string | null = null;

    @field({ decoder: Address })
    companyAddress: Address;

    @field({ decoder: StringDecoder, nullable: true })
    companyVATNumber: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    companyNumber: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 133 })
    ipAddress: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 133 })
    userAgent: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 210 })
    stripeAccountId: string | null = null;

    /**
     * @deprecated
     * Depending on areItemsIncludingVAT, this can either be including or excluding VAT
     */
    private get itemPrice() {
        return this.items.reduce((price, item) => price + item.price, 0);
    }

    includingVATToExcludingVAT(price: number) {
        // Always only round the VAT, not other prices
        return price - this.getVATOnIncludingVATAmount(price);
    }

    excludingVATToIncludingVAT(price: number) {
        // Always only round the VAT, not other prices
        return price + this.getVATOnExcludingVATAmount(price);
    }

    getVATOnIncludingVATAmount(price: number) {
        return Math.round(price * this.VATPercentage / (100 + this.VATPercentage));
    }

    getVATOnExcludingVATAmount(price: number) {
        // Make sure price result doesn't depend on the sign of the price
        return Math.round(Math.abs(price) * this.VATPercentage / 100) * Math.sign(price);
    }

    get useLegacyRounding() {
        // In the past we didn't round the price without VAT if we calculated starting from a price inclusive VAT
        // in that case, we only rounded the VAT
        return this.date && this.date < new Date('2025-12-01');
    }

    get priceWithoutVAT(): number {
        if (this.useLegacyRounding) {
            const itemPrice = this.itemPrice;
            if (this.areItemsIncludingVAT) {
                return itemPrice - this.VAT;
            }
            return itemPrice;
        }

        if (this.areItemsIncludingVAT) {
            // We round at individual item level
            // because PEPPOL requires prices with max 2 decimals on every line level, meaning we need to round.
            return this.items.reduce((price, item) => price + this.includingVATToExcludingVAT(item.price), 0);
        }
        return this.items.reduce((price, item) => price + item.price, 0);
    }

    get VAT(): number {
        if (this.useLegacyRounding && this.areItemsIncludingVAT) {
            // Subtract VAT and round
            // Need to be careful with circular calls
            return this.getVATOnIncludingVATAmount(this.itemPrice);
        }

        return this.getVATOnExcludingVATAmount(this.priceWithoutVAT);
    }

    get priceWithVAT(): number {
        return this.priceWithoutVAT + this.VAT;
    }

    /**
     * How much to add or remove to priceWithVAT to get to the payable amount. We can get a rounding error of 1 cent positive or negative if we calculate from a given price inclusive VAT.
     *
     * 1 cent if we need to add 1 cent
     * -1 cent if we need to remove 1 cent from the priceWithVAT to get to the payable amount
     */
    get payableRoundingAmount() {
        return this.totalPrice - this.priceWithVAT;
    }

    get totalPrice() {
        const itemPrice = this.itemPrice;
        if (this.areItemsIncludingVAT) {
            return itemPrice;
        }
        return itemPrice + this.VAT;
    }
}

/**
 * @deprecated use Invoice
 */
export class STInvoice extends AutoEncoder {
    /**
     * This ID is empty for a pending invoice
     */
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null;

    @field({ decoder: STInvoiceMeta })
    meta: STInvoiceMeta;

    /**
     * If the number is null, no invoice is generated yet. Its still a WIP invoice (not an official one!)
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    number: number | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 245 })
    negativeInvoiceId: string | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    didSendPeppol = false;
}

/**
 * @deprecated use Invoice
 */
export class STInvoicePrivate extends STInvoice {
    @field({ decoder: OrganizationSimple, optional: true })
    organization?: OrganizationSimple;

    @field({ decoder: Settlement, nullable: true })
    settlement: Settlement | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 186 })
    reference: string | null = null;

    matchQuery(query: string) {
        if (query === this.number?.toString() || query === this.id) {
            return true;
        }

        if (
            StringCompare.contains(this.meta.companyName, query)
            || StringCompare.typoCount(this.meta.companyAddress.city, query) < 2
            || StringCompare.contains(this.meta.companyContact, query)
            || (this.meta.companyVATNumber && StringCompare.typoCount(this.meta.companyVATNumber, query) < 2)
            || StringCompare.typoCount(this.meta.companyAddress.street, query) < 2
        ) {
            return true;
        }

        if (!this.organization) {
            return false;
        }

        if (
            StringCompare.typoCount(this.organization.name, query) < 2
            || StringCompare.typoCount(this.organization.address.city, query) < 2
            || StringCompare.typoCount(this.organization.address.street, query) < 2
            || StringCompare.typoCount(this.meta.companyName, query) < 2
            || StringCompare.typoCount(this.meta.companyName, query) < 2
        ) {
            return true;
        }
        return false;
    }
}

export class STPendingInvoice extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    id: string | null = null;

    @field({ decoder: STInvoiceMeta })
    meta: STInvoiceMeta;

    @field({ decoder: STInvoice, nullable: true })
    invoice: STInvoice | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    createdAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    updatedAt: Date | null = null;
}

export class STPendingInvoicePrivate extends STPendingInvoice {
    @field({ decoder: OrganizationSimple, optional: true })
    organization?: OrganizationSimple;
}

export class STInvoiceResponse extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    paymentUrl?: string;

    @field({ decoder: STInvoice, optional: true })
    invoice?: STInvoice;
}
