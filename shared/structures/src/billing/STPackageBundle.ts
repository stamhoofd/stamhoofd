import { Formatter } from '@stamhoofd/utility';
import { SimpleError } from '@common/errors';
import { v4 as uuidv4 } from 'uuid';
import { STPackage, STPackageMeta, STPackageType, STPricingType } from './STPackage.js';

/**
 * Package bundle are packages that you can buy
 */
export enum STPackageBundle {
    // Webshop package (max 10 webshops)
    Webshops = 'Webshops',

    // Full members package
    Members = 'Members',

    // One webshop package (max 1 webshop)
    // SingleWebshop = 'SingleWebshop',

    TrialMembers = 'TrialMembers',
    TrialWebshops = 'TrialWebshops',
}

export class STPackageBundleHelper {
    /**
     * Used for renewal. Should this package renew as what bundle?
     */
    static getBundle(type: STPackageType): STPackageBundle {
        switch (type) {
            case STPackageType.LegacyMembers:
            case STPackageType.Members:
                return STPackageBundle.Members;

            case STPackageType.Webshops:
            case STPackageType.SingleWebshop:
                return STPackageBundle.Webshops;

            case STPackageType.TrialMembers:
                return STPackageBundle.TrialMembers;

            case STPackageType.TrialWebshops:
                return STPackageBundle.TrialWebshops;
        }
    }

    /**
     * Package as if it has been renewed
     */
    static createRenewed(original: STPackage): STPackage {
        if (!original.meta.allowRenew) {
            throw new SimpleError({
                code: 'not_allowed',
                message: 'Not allowed',
                human: $t(`%x7`),
            });
        }

        if (!original.meta.keepPricesOnRenewal) {
            return this.getCurrentPackage(
                this.getBundle(original.meta.type),
                new Date(Math.max(new Date().getTime(), original.validUntil?.getTime() ?? 0)),
            );
        }

        const pack = original.clone();
        pack.id = uuidv4();

        // Not yet valid / active (ignored until valid)
        pack.validAt = null;

        const start = Formatter.luxon(new Date(Math.max(new Date().getTime(), original.endDate?.getTime() ?? 0) + 1_000)).startOf('day');
        const validUntil = start.plus({ years: 1 }).endOf('day');
        const removeAt = validUntil.plus({ months: 1 }).endOf('day');

        pack.meta.paidAmount = 0;
        pack.meta.paidPrice = 0;
        pack.meta.firstFailedPayment = null;
        pack.meta.didRenewId = original.id;

        // Duration for renewals is always a year ATM
        pack.meta.startDate = start.toJSDate();
        pack.validUntil = validUntil.toJSDate();

        // Remove (= not renewable) if not renewed after 3 months
        pack.removeAt = removeAt.toJSDate();

        if (original.meta.type === STPackageType.SingleWebshop) {
            // Deprecated package
            pack.meta.type = STPackageType.Webshops;
        }

        return pack;
    }

    static getTitle(bundle: STPackageBundle): string {
        switch (bundle) {
            case STPackageBundle.Members: return $t(`%Om`);
            case STPackageBundle.Webshops: return $t(`%1Hk`);
        }
        return '?';
    }

    static getDescription(bundle: STPackageBundle): string {
        switch (bundle) {
            case STPackageBundle.Members: return $t(`%1Hn`);
            case STPackageBundle.Webshops: return $t(`%1Ho`);
        }
        return '?';
    }

    static isPublic(bundle: STPackageBundle): boolean {
        switch (bundle) {
            case STPackageBundle.Members: return true;
            case STPackageBundle.Webshops: return true;
        }
        return false;
    }

    static getTrial(bundle: STPackageBundle): STPackageBundle | null {
        switch (bundle) {
            case STPackageBundle.Members: return STPackageBundle.TrialMembers;
            case STPackageBundle.Webshops:return STPackageBundle.TrialWebshops;
        }
        return null;
    }

    static isAlreadyBought(bundle: STPackageBundle, pack: STPackage): boolean {
        switch (bundle) {
            case STPackageBundle.Members: {
                if (pack.meta.type === STPackageType.Members) {
                    // Already bought
                    return true;
                }
                return false;
            }
            case STPackageBundle.Webshops: {
                if (pack.meta.type === STPackageType.Webshops) {
                    // Already bought
                    return true;
                }
                if (pack.meta.type === STPackageType.SingleWebshop) {
                    // Already bought
                    return true;
                }
                return false;
            }
        }
        return false;
    }

    static isInTrial(bundle: STPackageBundle, pack: STPackage): boolean {
        switch (bundle) {
            case STPackageBundle.Members: {
                if (pack.meta.type === STPackageType.TrialMembers) {
                    // Already bought
                    return true;
                }
                return false;
            }
            case STPackageBundle.Webshops: {
                if (pack.meta.type === STPackageType.TrialWebshops) {
                    // Already bought
                    return true;
                }
                return false;
            }
        }
        return false;
    }

    static isCombineable(bundle: STPackageBundle, pack: STPackage): boolean {
        switch (bundle) {
            case STPackageBundle.Members: {
                if (pack.meta.type === STPackageType.Members) {
                    // Already bought
                    return false;
                }
                return true;
            }
            case STPackageBundle.Webshops: {
                if (pack.meta.type === STPackageType.Webshops) {
                    // Already bought
                    return false;
                }
                return true;
            }
            case STPackageBundle.TrialMembers: {
                if (pack.meta.type === STPackageType.Members || pack.meta.type === STPackageType.TrialMembers) {
                    // Already bought
                    return false;
                }
                return true;
            }
            case STPackageBundle.TrialWebshops: {
                if (pack.meta.type === STPackageType.SingleWebshop || pack.meta.type === STPackageType.Webshops || pack.meta.type === STPackageType.TrialWebshops) {
                    // Already bought
                    return false;
                }
                return true;
            }
        }
        return false;
    }

    /**
     * If you buy a package that is not combineable with an existing one.
     * Should it start the package after the existing one expires (true) or should it ignore it (false)
     */
    static isStackable(bundle: STPackageBundle, pack: STPackage): boolean {
        switch (bundle) {
            case STPackageBundle.TrialMembers: {
                // Not allowed to start a trial even if pack is expired
                return false;
            }
            case STPackageBundle.TrialWebshops: {
                // Not allowed to start a trial again if pack is expired
                return false;
            }
        }
        return true;
    }

    /**
     * Create a new package for this type that starts on 'date' and return the pricing
     */
    static getCurrentPackage(bundle: STPackageBundle, date: Date): STPackage {
        const start = Formatter.luxon(date).startOf('day');
        switch (bundle) {
            case STPackageBundle.Members: {
                const validUntil = start.plus({ years: 1 }).endOf('day');
                const removeAt = validUntil.plus({ months: 1 }).endOf('day');

                return STPackage.create({
                    validUntil: validUntil.toJSDate(),
                    removeAt: removeAt.toJSDate(),
                    meta: STPackageMeta.create({
                        type: STPackageType.Members,
                        unitPrice: 1_0000, // 1 euro
                        minimumAmount: 0,
                        allowRenew: true,
                        pricingType: STPricingType.PerMember,
                        startDate: start.toJSDate(),
                        canDeactivate: STAMHOOFD.environment === 'development', // Cannot deactivate in production because they already paid for it.
                    }),
                });
            }

            case STPackageBundle.Webshops: {
                return STPackage.create({
                    validUntil: null,
                    removeAt: null,
                    meta: STPackageMeta.create({
                        type: STPackageType.Webshops,
                        unitPrice: 0,
                        minimumAmount: 0,
                        allowRenew: false,
                        pricingType: STPricingType.Fixed,
                        serviceFeeFixed: 0,
                        serviceFeePercentage: 2_00,
                        serviceFeeMaximum: 2000, // 20 cent
                        startDate: start.toJSDate(),
                        canDeactivate: true,
                    }),
                });
            }
            case STPackageBundle.TrialMembers: {
                const validUntil = start.plus({ days: 14 }).endOf('day');
                const removeAt = validUntil;

                return STPackage.create({
                    validUntil: validUntil.toJSDate(),
                    removeAt: removeAt.toJSDate(),
                    meta: STPackageMeta.create({
                        type: STPackageType.TrialMembers,
                        unitPrice: 0,
                        minimumAmount: 1,
                        allowRenew: false,
                        pricingType: STPricingType.Fixed,
                        startDate: start.toJSDate(),
                        canDeactivate: true,
                    }),
                });
            }

            case STPackageBundle.TrialWebshops: {
                const validUntil = start.plus({ days: 14 }).endOf('day');
                const removeAt = validUntil;

                return STPackage.create({
                    validUntil: validUntil.toJSDate(),
                    removeAt: removeAt.toJSDate(),
                    meta: STPackageMeta.create({
                        type: STPackageType.TrialWebshops,
                        unitPrice: 0,
                        minimumAmount: 1,
                        allowRenew: false,
                        pricingType: STPricingType.Fixed,
                        startDate: start.toJSDate(),
                        canDeactivate: true,
                    }),
                });
            }
        }

        throw new Error('Package not available');
    }
}
