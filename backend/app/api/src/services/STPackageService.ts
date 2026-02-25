import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Platform, Registration, STPackage } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, Country, PaymentCustomer, STPricingType, TranslatedString, VATExcemptReason } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export class STPackageService {
    /**
     * Returns an up to date amount that should be charged for this package.
     * Note that this value could be smaller than the already charged amount.
     */
    static async getChargeableQuantity(pack: STPackage) {
        // If type is
        let amount = 1;
        let membersCount: number | null = null;

        if (membersCount === null && pack.meta.pricingType === STPricingType.PerMember) {
            membersCount = await Registration.getActiveMembers(pack.organizationId);
        }

        if (pack.meta.pricingType === STPricingType.PerMember) {
            amount = membersCount ?? 1;
        }

        if (amount < pack.meta.minimumAmount) {
            amount = pack.meta.minimumAmount;
        }

        return amount;
    }

    static async getPaidOrPendingQuantity(pack: STPackage) {
        if (!pack.existsInDatabase || pack.createdAt.getTime() > Date.now() - 1_000) {
            return 0;
        }

        return await BalanceItem.select()
            .where('packageId', pack.id)
            .where('status', BalanceItemStatus.Due)
            .count(SQL.column('amount'));
    }

    /**
     * Create a balance item to charge an increase in amount of a given package.
     *
     * Convertable into STInvoiceItem (or the diffence if amount is increased)
     * Use this to calculate prices or create an invoice
     * This will calculate the price to expand the package to the given amount.
     * If you want to renew a package, you need to create a new package first
     */
    static async chargePackage(pack: STPackage, date?: Date, customer?: PaymentCustomer): Promise<BalanceItem | null> {
        let unitPrice = Math.round(pack.meta.unitPrice);

        let amount = await this.getChargeableQuantity(pack);

        if (amount < pack.meta.minimumAmount) {
            // Minimum should get applied first, because we might already have paid for the minimum (paid amount)
            amount = pack.meta.minimumAmount;
        }

        const paid = await this.getPaidOrPendingQuantity(pack);
        amount -= paid;

        if (amount <= 0) {
            amount = 0;
        }

        if (amount <= 0) {
            return null;
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

        const item = new BalanceItem();
        item.type = BalanceItemType.Other;
        item.description = pack.meta.name + ' ' + (
            pack.validUntil
                ? $t('van {startDate} tot {endDate}', { startDate: Formatter.date(now, true), endDate: Formatter.date(pack.validUntil, true) })
                : $t('vanaf {startDate}', { startDate: Formatter.date(pack.meta.startDate, true) })
        );
        item.relations.set(BalanceItemRelationType.STPackage, BalanceItemRelation.create({
            id: pack.id,
            name: TranslatedString.create(pack.meta.name),
        }));
        item.packageId = pack.id;
        item.startDate = now;

        if (pack.validUntil) {
            item.endDate = pack.validUntil;
        }

        item.payingOrganizationId = pack.organizationId;
        const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
        if (!membershipOrganizationId) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'No membership organization id set on the platform',
                human: 'Package purchases are currently unavailable',
            });
        }
        item.organizationId = membershipOrganizationId;
        item.VATPercentage = 21;
        item.VATIncluded = false;
        item.VATExcempt = null;
        item.quantity = amount;
        item.unitPrice = unitPrice;
        item.createdAt = now;
        item.status = BalanceItemStatus.Hidden;

        if (customer && customer.company && customer.company.address) {
            // Reverse charged vat applicable?
            if (customer.company.address.country !== Country.Belgium) {
                item.VATExcempt = VATExcemptReason.IntraCommunity;
            }
        }

        return item;
    }
}
