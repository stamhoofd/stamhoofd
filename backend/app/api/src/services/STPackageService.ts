import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Organization, Platform, STPackage } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import type { Company, PaymentCustomer } from '@stamhoofd/structures';
import { getPricingTypeName, STPackageStatus, STPackageType } from '@stamhoofd/structures';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, STPricingType, TranslatedString, VATExcemptReason } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Formatter, STMath } from '@stamhoofd/utility';
import { GroupBuilder } from '../helpers/GroupBuilder.js';
import { PaymentService } from './PaymentService.js';
import { VATService } from './VATService.js';

export class STPackageService {
    static async getActivePackages(organizationId: string) {
        return await STPackage.select()
            .where('organizationId', organizationId)
            .andWhere('validAt', '!=', null)
            .andWhere(
                SQL.where('removeAt', null)
                    .or('removeAt', '>', new Date()),
            )
            .orderBy('validAt', 'DESC')
            .fetch();
    }

    static async getValidPackagesWithExpired(organizationId: string) {
        return await STPackage.select()
            .where('organizationId', organizationId)
            .andWhere('validAt', '!=', null)
            .orderBy('validAt', 'DESC')
            .fetch();
    }

    /**
     * Returns an up to date amount that should be charged for this package.
     * Note that this value could be smaller than the already charged amount.
     */
    static async getChargeableQuantity(pack: STPackage) {
        // If type is
        let amount = 1;

        if (pack.meta.pricingType === STPricingType.PerMember) {
            amount = await Organization.getActiveMembers(pack.organizationId);
        }

        if (amount < pack.meta.minimumAmount) {
            amount = pack.meta.minimumAmount;
        }

        return amount;
    }

    static async markValid(packageId: string) {
        const pack = await STPackage.getByID(packageId);
        if (!pack) {
            console.error('Missing STPackage when marking STPackage as valid', packageId);
            return;
        }
        if (pack.validAt) {
            // Already valid
            return;
        }

        console.log('Marking STPackage as valid', packageId);
        pack.validAt = new Date();
        await pack.save();

        if (pack.meta.didRenewId) {
            const didRenewPackage = await STPackage.getByID(pack.meta.didRenewId);
            if (didRenewPackage && didRenewPackage.organizationId === pack.organizationId) {
                await this.didRenew(didRenewPackage, pack);
            }
        }

        await this.updateOrganizationPackages(pack.organizationId);
    }

    static async didRenew(old: STPackage, renewedBy: STPackage) {
        old.removeAt = renewedBy.meta.startDate ?? renewedBy.validAt ?? new Date();
        old.meta.allowRenew = false;
        await old.save();
    }

    static async getPaidOrPendingQuantity(pack: STPackage) {
        if (!pack.existsInDatabase || pack.createdAt.getTime() > Date.now() - 1_000) {
            return 0;
        }

        return await BalanceItem.select()
            .where('packageId', pack.id)
            .where('status', BalanceItemStatus.Due)
            .sum(SQL.column('amount'));
    }

    /**
     * Create a balance item to charge an increase in amount of a given package.
     *
     * Convertable into STInvoiceItem (or the diffence if amount is increased)
     * Use this to calculate prices or create an invoice
     * This will calculate the price to expand the package to the given amount
     * If you want to renew a package, you need to create a new package first
     */
    static async chargePackage(pack: STPackage, sellingOrganization: Organization, company: Company | null | undefined, date?: Date): Promise<BalanceItem | null> {
        let unitPrice = Math.round(pack.meta.unitPrice);

        let amount = await this.getChargeableQuantity(pack);
        const paid = await this.getPaidOrPendingQuantity(pack);
        amount -= paid;

        if (amount <= 0) {
            console.log('Not charging package', pack.id, 'amount is', amount);
            return null;
        }

        /// When pricing type is memebrs, the price is calculated per year.
        /// If a shorter period is remaining, we give a discount in order
        /// to no need to handle it more complicated
        let now = date ?? Formatter.luxon().startOf('day').toJSDate();
        if (now < pack.meta.startDate) {
            // When creating a new package, we sometimes buy it for the future, so use that date instead of now
            now = pack.meta.startDate;
        }

        if (pack.endDate && pack.meta.pricingType !== STPricingType.Fixed) {
            const totalDays = Math.round((pack.endDate.getTime() - pack.meta.startDate.getTime()) / (1000 * 60 * 60 * 24));
            let remainingDays = Math.round((pack.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
            } else {
                unitPrice = Math.round(unitPrice);
            }
        }

        const item = new BalanceItem();
        item.type = BalanceItemType.STPackage;
        item.description = pack.meta.name + ' ' + (
            pack.endDate
                ? $t('%1LM', { startDate: Formatter.startDate(now, false, true), endDate: Formatter.endDate(pack.endDate, false, true) })
                : $t('%1LN', { startDate: Formatter.startDate(pack.meta.startDate, false, true) })
        );
        item.relations.set(BalanceItemRelationType.STPackage, BalanceItemRelation.create({
            id: pack.id,
            name: TranslatedString.create(pack.meta.name),
        }));
        item.relations.set(BalanceItemRelationType.STPricingType, BalanceItemRelation.create({
            id: pack.meta.pricingType,
            name: TranslatedString.create(getPricingTypeName(pack.meta.pricingType)),
        }));

        item.packageId = pack.id;
        item.startDate = now;

        if (pack.endDate) {
            item.endDate = pack.endDate;
        }

        item.payingOrganizationId = pack.organizationId;
        item.organizationId = sellingOrganization.id;
        item.VATPercentage = 21;
        item.VATIncluded = false;
        item.VATExcempt = VATService.getVATExcempt({
            company,
            sellingOrganization,
            type: 'services',
        });
        item.quantity = amount;
        item.unitPrice = STMath.round(unitPrice / 100) * 100;
        item.createdAt = new Date();
        item.status = BalanceItemStatus.Hidden;

        return item;
    }

    private static async getForOrganizationIncludingExpired(organizationId: string) {
        const packages = await STPackage.select()
            .where('organizationId', organizationId)
            .where('validAt', '!=', null)
            .orderBy('validAt', 'DESC')
            .fetch();

        return packages;
    }

    private static async getOrganizationPackagesMap(organizationId: string): Promise<Map<STPackageType, STPackageStatus>> {
        const map = new Map<STPackageType, STPackageStatus>();

        if (STAMHOOFD.userMode === 'platform' || organizationId === ((await Platform.getShared()).membershipOrganizationId)) {
            map.set(STPackageType.Webshops, STPackageStatus.create({
                startDate: new Date(0),
            }));

            map.set(STPackageType.Members, STPackageStatus.create({
                startDate: new Date(0),
            }));
            return map;
        }

        const packages = await this.getForOrganizationIncludingExpired(organizationId);

        for (const pack of packages) {
            const exist = map.get(pack.meta.type);
            if (exist) {
                exist.merge(pack.createStatus());
            } else {
                map.set(pack.meta.type, pack.createStatus());
            }
        }

        return map;
    }

    static async updateOrganizationPackages(organizationId: string) {
        console.log('Updating packages for organization ' + organizationId);
        const map = await this.getOrganizationPackagesMap(organizationId);

        const organization = await Organization.getByID(organizationId);
        if (organization) {
            const didUseMembers = organization.meta.packages.useMembers && organization.meta.packages.useActivities;
            organization.meta.packages.packages = map;
            await organization.save();

            if (!didUseMembers && organization.meta.packages.useMembers && organization.meta.packages.useActivities) {
                console.log('Building groups and categories for ' + organization.id);
                const builder = new GroupBuilder(organization);
                await builder.build();
            }
        } else {
            console.error("Couldn't find organization when updating packages " + organizationId);
        }
    }

    static async markFailedPayment(organizationId: string) {
        console.log('Marking packages with failed payment for ' + organizationId);

        // Mark all active packages as failed
        const activePackages = await this.getActivePackages(organizationId);
        for (const pack of activePackages) {
            console.log('Marking package with failed payment ' + pack.id);
            pack.meta.firstFailedPayment = pack.meta.firstFailedPayment ?? new Date();
            pack.meta.paymentFailedCount++;
            await pack.save();
        }
        await this.updateOrganizationPackages(organizationId);
    }
}
