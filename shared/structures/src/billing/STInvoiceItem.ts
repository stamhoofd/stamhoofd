import { AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';
import { STPackage, STPricingType } from './STPackage.js';

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
