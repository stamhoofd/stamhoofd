import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';

import { Address } from '../addresses/Address.js';
import { Country } from '../addresses/CountryDecoder.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';
import { InvoiceItem } from './InvoiceItem.js';
import { Formatter } from '@stamhoofd/utility';

export enum STPackageType {
    // Members without activities (not available in frontend anymore)
    LegacyMembers = 'LegacyMembers',

    // Full members package
    Members = 'Members',

    // Webshop package (max 10 webshops)
    Webshops = 'Webshops',

    // One webshop package (max 1 webshop)
    SingleWebshop = 'SingleWebshop',

    TrialMembers = 'TrialMembers',
    TrialWebshops = 'TrialWebshops',
}

export class STPackageTypeHelper {
    static getName(type: STPackageType): string {
        switch (type) {
            case STPackageType.LegacyMembers: return $t(`d855727b-b760-4d38-8506-d1ba215256c9`);
            case STPackageType.Members: {
                return $t(`e15286b6-ccc1-463c-95de-d5d87b6b84a4`);
            }
            case STPackageType.Webshops: {
                return $t(`3b1c092c-fdb5-4322-a34d-b8142881b3cf`);
            }
            case STPackageType.SingleWebshop: {
                return $t(`fb1cc501-93bd-45e9-9ce6-26c3f4427205`);
            }
            case STPackageType.TrialMembers: return $t(`752fdb9b-b159-41b3-95d1-fc3bd83bf9b4`);
            case STPackageType.TrialWebshops: return $t(`6aeb7f4b-9a84-4738-b3ca-db96a7c92fcd`);
        }
    }
}

export enum STPricingType {
    Fixed = 'Fixed',

    /**
     * Package is renewable per year
     * Package can get extended initially to a specific date
     */
    PerYear = 'PerYear',

    /**
     * Price is per member, per year
     */
    PerMember = 'PerMember',
}

export class STPackageMeta extends AutoEncoder {
    get name(): string {
        return STPackageTypeHelper.getName(this.type);
    }

    /**
     * ID of the package that was renewed (if it was renewed)
     */
    @field({ decoder: StringDecoder, optional: true })
    didRenewId?: string;

    @field({ decoder: new EnumDecoder(STPackageType) })
    type: STPackageType;

    @field({ decoder: new EnumDecoder(STPricingType) })
    pricingType = STPricingType.Fixed;

    /**
     * One time price for the package, per year, or per member depending on pricingType
     */
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    unitPrice = 0;

    /**
     * Service fees, percentage. 100_00 = 100%, 1 = 0.01%
     */
    @field({ decoder: IntegerDecoder, optional: true })
    serviceFeePercentage = 0;

    /**
     * Fixed service fee per payment, in cents
     */
    @field({ decoder: IntegerDecoder, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true })
    serviceFeeFixed = 0;

    /**
     * Fixed service fee per payment, in cents
     */
    @field({ decoder: IntegerDecoder, optional: true, nullable: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true, nullable: true })
    serviceFeeMinimum: number | null = null;

    /**
     * Fixed service fee per payment, in cents
     */
    @field({ decoder: IntegerDecoder, optional: true, nullable: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true, nullable: true })
    serviceFeeMaximum: number | null = null;

    /// Contains the (paid) invoiced amount
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    paidAmount = 0;

    /// Contains the (paid) invoiced price. Used for statistics and reporting
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    paidPrice = 0;

    /**
     * Minimum amount that will needs to get invoiced. Only used for first invoice
     */
    @field({ decoder: IntegerDecoder })
    minimumAmount = 1;

    /**
     * Only used if applicable
     */
    @field({ decoder: BooleanDecoder })
    autorenew = true;

    /**
     * Only used if applicable
     */
    @field({ decoder: BooleanDecoder })
    allowRenew = false;

    /// If a top up is done, and the payment fails, set the date here
    /// + increase the payment failed count.
    /// After x days this will disable all functions if it keeps failing
    @field({ decoder: DateDecoder, nullable: true })
    firstFailedPayment: Date | null = null;

    @field({ decoder: IntegerDecoder })
    paymentFailedCount = 0;

    /**
     * Date when the package starts. Is is valid until validUntil
     */
    @field({ decoder: DateDecoder })
    startDate: Date;

    @field({ decoder: BooleanDecoder })
    canDeactivate = false;
}

/**
 * A package contains a price agreement for a given period that might be renewable
 */
export class STPackage extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: STPackageMeta })
    meta: STPackageMeta;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder })
    updatedAt = new Date();

    /**
     * validAt is null if the initial needed payment is missing. The package can be ignore
     * It contains the date when the package was validated and added correctly.
     */
    @field({ decoder: DateDecoder, nullable: true })
    validAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    validUntil: Date | null = null;

    /// Disable / delete this package after this date (also no renew allowed). Can't keep using the currently saved pricing
    @field({ decoder: DateDecoder, nullable: true })
    removeAt: Date | null = null;

    shouldHintRenew() {
        if (!this.meta.allowRenew || this.validUntil === null) {
            return false;
        }

        if (this.meta.startDate > new Date()) {
            // Not yet activated
            return false;
        }

        // Allow renew 2 months in advance
        const allowAfter = new Date(this.validUntil);
        allowAfter.setDate(allowAfter.getDate() - 31 * 2);

        if (allowAfter < new Date()) {
            return true;
        }
        return false;
    }

    get status() {
        return STPackageStatus.create({
            startDate: this.meta.startDate,
            validUntil: this.validUntil,
            removeAt: this.removeAt,
            firstFailedPayment: this.meta.firstFailedPayment,
        });
    }

    /**
     * Create a renewed package, but not yet saved!
     */
    createRenewed(): STPackage {
        if (!this.meta.allowRenew) {
            throw new SimpleError({
                code: 'not_allowed',
                message: 'Not allowed',
                human: 'Je kan dit pakket niet verlengen',
            });
        }

        const pack = new STPackage();
        pack.id = uuidv4();
        pack.meta = this.meta;

        // Not yet valid / active (ignored until valid)
        pack.validAt = null;

        pack.meta.startDate = new Date(Math.max(new Date().getTime(), this.validUntil?.getTime() ?? 0));
        pack.meta.paidAmount = 0;
        pack.meta.paidPrice = 0;
        pack.meta.firstFailedPayment = null;
        pack.meta.didRenewId = this.id;

        // Duration for renewals is always a year ATM
        pack.validUntil = new Date(pack.meta.startDate);
        pack.validUntil.setFullYear(pack.validUntil.getFullYear() + 1);

        // Remove (= not renewable) if not renewed after 3 months
        pack.removeAt = new Date(pack.validUntil);
        pack.removeAt.setMonth(pack.removeAt.getMonth() + 3);

        if (this.meta.type === STPackageType.SingleWebshop) {
            pack.meta.type = STPackageType.Webshops;
        }

        // Todo: sometimes we should not change the prices
        // Change prices
        if (pack.meta.type === STPackageType.Webshops) {
            pack.meta.serviceFeeFixed = 0;
            pack.meta.serviceFeePercentage = 2_00;
            pack.meta.serviceFeeMinimum = 0;
            pack.meta.serviceFeeMaximum = 20;

            pack.meta.unitPrice = 0;
            pack.meta.pricingType = STPricingType.Fixed;
            pack.validUntil = null;
            pack.removeAt = null;
        }
        else if (pack.meta.type === STPackageType.Members) {
            pack.meta.serviceFeeFixed = 0;
            pack.meta.serviceFeePercentage = 0;
            pack.meta.serviceFeeMinimum = 0;
            pack.meta.serviceFeeMaximum = 0;

            pack.meta.unitPrice = 100;
            pack.meta.pricingType = STPricingType.PerMember;
        }

        return pack;
    }

    /**
     * Create the initial invoice item for this package with the initial amounts.
     */
    createInvoiceItem({ amount = 1, date }: { amount: number; date?: Date }): InvoiceItem {
        let unitPrice = Math.round(this.meta.unitPrice);

        if (amount < this.meta.minimumAmount) {
            // Minimum should get applied first, because we might already have paid for the minimum (paid amount)
            amount = this.meta.minimumAmount;
        }

        amount -= this.meta.paidAmount;
        if (amount <= 0) {
            amount = 0;
        }

        /// When pricing type is memebrs, the price is calculated per year.
        /// If a shorter period is remaining, we give a discount in order
        /// to no need to handle it more complicated
        let now = date ?? new Date();
        if (now < this.meta.startDate) {
            // When creating a new package, we sometimes buy it for the future, so use that date instead of now
            now = this.meta.startDate;
        }

        if (this.validUntil && this.meta.pricingType !== STPricingType.Fixed) {
            const totalDays = Math.round((this.validUntil.getTime() - this.meta.startDate.getTime()) / (1000 * 60 * 60 * 24));
            let remainingDays = Math.round((this.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            /// First 3 months are full price
            const paidDays = 30 * 3;

            if (remainingDays > totalDays) {
                remainingDays = totalDays;
            }

            if (totalDays > 366) {
                // Increase unit price
                unitPrice = unitPrice * (totalDays / 365);
            }

            if (this.meta.pricingType === STPricingType.PerMember) {
                unitPrice = Math.round(Math.min(unitPrice, unitPrice * remainingDays / (Math.max(365, totalDays) - paidDays)));
            }
            else {
                unitPrice = Math.round(unitPrice);
            }
        }

        const item = InvoiceItem.create({
            name: this.meta.name,
            description: this.validUntil ? ('Van ' + Formatter.date(now, true) + ' tot ' + Formatter.date(this.validUntil, true)) : ('Vanaf ' + Formatter.date(this.meta.startDate, true)),
            unitPrice: unitPrice,
            baseAmount: 1,
            amount: amount,
            VATPercentage: 21,
            packageId: this.id,
        });

        return item;
    }
}

export class STPackageStatusServiceFee extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    fixed = 0;

    @field({ decoder: IntegerDecoder })
    percentage = 0;

    @field({ decoder: IntegerDecoder, nullable: true, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true, optional: true })
    minimum: number | null = null;

    @field({ decoder: IntegerDecoder, nullable: true, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true, optional: true })
    maximum: number | null = null;

    @field({ decoder: DateDecoder })
    startDate: Date;

    @field({ decoder: DateDecoder, nullable: true })
    endDate: Date | null = null;
}

export class STPackageStatus extends AutoEncoder {
    @field({ decoder: DateDecoder })
    startDate: Date;

    @field({ decoder: DateDecoder, nullable: true })
    validUntil: Date | null = null;

    /// Disable / delete this package after this date (also no renew allowed). Can't keep using the currently saved pricing
    @field({ decoder: DateDecoder, nullable: true })
    removeAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    firstFailedPayment: Date | null = null;

    /**
     * Service fees, percentage. 100_00 = 100%, 1 = 0.01%
     */
    @field({ decoder: new ArrayDecoder(STPackageStatusServiceFee), optional: true })
    serviceFees: STPackageStatusServiceFee[] = [];

    get activeServiceFees(): STPackageStatusServiceFee {
        const now = new Date();
        const filtered = this.serviceFees.filter((fee) => {
            if (fee.startDate <= now && (fee.endDate === null || fee.endDate >= now)) {
                return true;
            }
            return false;
        });

        // Return maximum fees
        if (filtered.length === 0) {
            return STPackageStatusServiceFee.create({
                fixed: 0,
                percentage: 0,
                startDate: new Date(),
                endDate: null,
            });
        }

        if (filtered.length === 1) {
            return filtered[0]; // Only one fee, return it
        }

        console.warn('Multiple active service fees found, merging them', filtered);

        return filtered.reduce((max, current) => {
            return STPackageStatusServiceFee.create({
                fixed: Math.max(max.fixed, current.fixed),
                percentage: Math.max(max.percentage, current.percentage),
                startDate: max.startDate,
                endDate: max.endDate,
                minimum: max.minimum !== null ? Math.max(max.minimum, current.minimum ?? 0) : current.minimum,
                maximum: max.maximum !== null ? Math.max(max.maximum, current.maximum ?? 0) : current.maximum,
            });
        });
    }

    get isActive() {
        const d = new Date();

        /// Active if it starts within 10 seconds (fixes time differences between server and clients)
        if (this.startDate && this.startDate > new Date(d.getTime() + 10 * 1000)) {
            return false;
        }

        if (this.removeAt && this.removeAt < d) {
            return false;
        }

        if (this.validUntil && this.validUntil < d) {
            return false;
        }

        // Deactivate module if payment failed, and not reactivated after 4 weeks
        const expire = new Date();
        expire.setDate(expire.getDate() - 28);
        if (this.firstFailedPayment && this.firstFailedPayment < expire) {
            return false;
        }

        return true;
    }

    /**
     * Purchased the package, the package is not yet removed, but it is expired or not paid after 4 weeks following a failed payment
     */
    get wasActive() {
        if (this.isActive) {
            return false;
        }

        const d = new Date();

        /// Active if it starts within 10 seconds (fixes time differences between server and clients)
        if (this.startDate && this.startDate > new Date(d.getTime() + 10 * 1000)) {
            return false;
        }

        // If only valid for less than 30 days, still allow to use the package
        if (this.validUntil && this.validUntil.getTime() - this.startDate.getTime() < 60 * 1000 * 60 * 24 * 31) {
            return false;
        }

        if (this.validUntil && this.validUntil < d) {
            // Passed!
            return true;
        }

        // Deactivate module if payment failed, and not reactivated after 4 weeks
        const expire = new Date();
        expire.setDate(expire.getDate() - 28);
        if (this.firstFailedPayment && this.firstFailedPayment < expire) {
            // did not pay!
            return true;
        }

        return false;
    }

    get deactivateDate(): Date | null {
        const dates: Date[] = [];
        if (this.removeAt !== null) {
            dates.push(this.removeAt);
        }

        if (this.validUntil !== null) {
            dates.push(this.validUntil);
        }

        if (this.firstFailedPayment !== null) {
            const expire = new Date(this.firstFailedPayment);
            expire.setDate(expire.getDate() + 28);
            dates.push(expire);
        }

        if (dates.length === 0) {
            return null;
        }

        return new Date(Math.min(...dates.map(d => d.getTime())));
    }

    merge(status: STPackageStatus) {
        if (status.startDate < this.startDate) {
            this.startDate = status.startDate;
            // TODO: fix behaviour with gaps if we allow that in the future
        }

        if (status.validUntil === null) {
            this.validUntil = null;
        }
        else if (this.validUntil !== null) {
            if (status.validUntil > this.validUntil) {
                this.validUntil = status.validUntil;
            }
        }

        if (status.removeAt === null) {
            this.removeAt = null;
        }
        else if (this.removeAt !== null) {
            if (status.removeAt > this.removeAt) {
                this.removeAt = status.removeAt;
            }
        }

        if (this.firstFailedPayment === null) {
            this.firstFailedPayment = status.firstFailedPayment;
        }
        else if (status.firstFailedPayment !== null) {
            if (status.firstFailedPayment < this.firstFailedPayment) {
                this.firstFailedPayment = status.firstFailedPayment;
            }
        }

        this.serviceFees.push(...status.serviceFees);
    }
}

export function calculateVATPercentage(address: Address, VATNumber: string | null) {
    // Determine VAT rate
    let VATRate = 0;
    if (address.country === Country.Belgium) {
        VATRate = 21;
    }
    else {
        if (VATNumber && VATNumber.substr(0, 2).toUpperCase() !== 'BE') {
            VATRate = 0;
        }
        else {
            // Apply VAT rate of the home country for consumers in the EU

            switch (address.country) {
                case Country.Netherlands:
                    VATRate = 21;
                    break;
                case Country.Luxembourg:
                    VATRate = 17;
                    break;
                case Country.France:
                    VATRate = 20;
                    break;
                case Country.Germany:
                    VATRate = 19;
                    break;
                default: {
                    throw new SimpleError({
                        code: 'country_not_supported',
                        message: 'Non-business sales to your country are not yet supported. Please enter a valid VAT number.',
                    });
                }
            }
        }
    }
    return VATRate;
}
