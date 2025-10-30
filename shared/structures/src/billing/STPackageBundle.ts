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
    SingleWebshop = 'SingleWebshop',

    TrialMembers = 'TrialMembers',
    TrialWebshops = 'TrialWebshops',
}

export class STPackageBundleHelper {
    static getTitle(bundle: STPackageBundle): string {
        switch (bundle) {
            case STPackageBundle.Members: return $t(`e15286b6-ccc1-463c-95de-d5d87b6b84a4`);
            case STPackageBundle.Webshops: return $t(`3b1c092c-fdb5-4322-a34d-b8142881b3cf`);
        }
        return '?';
    }

    static getDescription(bundle: STPackageBundle): string {
        switch (bundle) {
            case STPackageBundle.Members: return $t(`2e76098c-b75a-4c40-ae13-03bbc1f06b3e`);
            case STPackageBundle.Webshops: return $t(`3c731bcc-187c-437f-8d6c-f1c1b1207c86`);
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

    static requiresMandate(bundle: STPackageBundle): boolean {
        switch (bundle) {
            case STPackageBundle.Members: return true;
            case STPackageBundle.Webshops: return true;
        }
        return false;
    }

    /**
     * If you buy a package that is not combineable with an existing one, should it throw an error?
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
            case STPackageBundle.SingleWebshop: {
                if (pack.meta.type === STPackageType.SingleWebshop || pack.meta.type === STPackageType.Webshops) {
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
            case STPackageBundle.SingleWebshop: {
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
            case STPackageBundle.SingleWebshop: {
                if (pack.meta.type === STPackageType.SingleWebshop || pack.meta.type === STPackageType.Webshops) {
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
     * Create a new package for this type and return the pricing
     */
    static getCurrentPackage(bundle: STPackageBundle, date: Date): STPackage {
        switch (bundle) {
            case STPackageBundle.Members: {
                // 1 year valid
                const validUntil = new Date(date);
                validUntil.setFullYear(validUntil.getFullYear() + 1);

                // Remove (= not renewable) if not renewed after 1 month
                const removeAt = new Date(validUntil);
                removeAt.setMonth(removeAt.getMonth() + 1);

                return STPackage.create({
                    validUntil,
                    removeAt,
                    meta: STPackageMeta.create({
                        type: STPackageType.Members,
                        unitPrice: 100,
                        minimumAmount: 0,
                        allowRenew: true,
                        pricingType: STPricingType.PerMember,
                        startDate: new Date(date),
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
                        serviceFeeMaximum: 20,
                        startDate: new Date(date),
                        canDeactivate: true,
                    }),
                });
            }
            case STPackageBundle.TrialMembers: {
                // Disable functions after two weeks, manual reenable required
                const validUntil = new Date(date);
                validUntil.setDate(validUntil.getDate() + 14);

                // Remove if not valid anymore
                const removeAt = new Date(validUntil);

                return STPackage.create({
                    validUntil,
                    removeAt,
                    meta: STPackageMeta.create({
                        type: STPackageType.TrialMembers,
                        unitPrice: 0,
                        minimumAmount: 1,
                        allowRenew: false,
                        pricingType: STPricingType.Fixed,
                        startDate: new Date(date),
                        canDeactivate: true,
                    }),
                });
            }

            case STPackageBundle.TrialWebshops: {
                // Disable functions after two weeks, manual reenable required
                const validUntil = new Date(date);
                validUntil.setDate(validUntil.getDate() + 14);

                // Remove if not valid anymore
                const removeAt = new Date(validUntil);

                return STPackage.create({
                    validUntil,
                    removeAt,
                    meta: STPackageMeta.create({
                        type: STPackageType.TrialWebshops,
                        unitPrice: 0,
                        minimumAmount: 1,
                        allowRenew: false,
                        pricingType: STPricingType.Fixed,
                        startDate: new Date(date),
                        canDeactivate: true,
                    }),
                });
            }
        }

        throw new Error('Package not available');
    }
}
