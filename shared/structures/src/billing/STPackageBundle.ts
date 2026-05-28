import { Formatter } from '../../../utility/dist/Formatter.js';
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
