import { STPackage, STPackageMeta, STPackageType, STPricingType } from "./STPackage"

/**
 * Package bundle are packages that you can buy
 */
export enum STPackageBundle {
    // Full members package
    "Members" = "Members",

    // Webshop package (max 10 webshops)
    "Webshops" = "Webshops",

    // One webshop package (max 1 webshop)
    "SingleWebshop" = "SingleWebshop",

    "TrialMembers" = "TrialMembers",
    "TrialWebshops" = "TrialWebshops",
}

export class STPackageBundleHelper {
    static getTitle(bundle: STPackageBundle): string {
        switch(bundle) {
            case STPackageBundle.Members: return "Ledenadministratie voor één jaar"
            case STPackageBundle.Webshops: return "Webshops (max. 10) voor één jaar"
            case STPackageBundle.SingleWebshop: return "Eén webshop voor twee maanden"
        }
        return "?"
    }

    static getDescription(bundle: STPackageBundle): string {
        switch(bundle) {
            case STPackageBundle.Members: return "€ 0,5 per jaar, per lid. Minimum € 59 per jaar (minder leden kan uiteraard)"
            case STPackageBundle.Webshops: return "€ 59 per jaar"
            case STPackageBundle.SingleWebshop: return "€ 39 per jaar"
        }
        return "?"
    }

    static isPublic(bundle: STPackageBundle): boolean {
        switch(bundle) {
            case STPackageBundle.Members: return true;
            case STPackageBundle.Webshops: return true;
            case STPackageBundle.SingleWebshop: return true;
        }
        return false
    }

    static isCombineable(bundle: STPackageBundle, pack: STPackage): boolean {
        switch(bundle) {
            case STPackageBundle.Members: {
                if (pack.meta.type === STPackageType.Members) {
                    // Already bought
                    return false
                }
                return true
            }
            case STPackageBundle.Webshops: {
                if (pack.meta.type === STPackageType.Webshops) {
                    // Already bought
                    return false
                }
                return true
            }
            case STPackageBundle.SingleWebshop: {
                if (pack.meta.type === STPackageType.SingleWebshop || pack.meta.type === STPackageType.Webshops) {
                    // Already bought
                    return false
                }
                return true
            }
            case STPackageBundle.TrialMembers: {
                if (pack.meta.type === STPackageType.Members) {
                    // Already bought
                    return false
                }
                return true
            }
            case STPackageBundle.TrialWebshops: {
                if (pack.meta.type === STPackageType.SingleWebshop || pack.meta.type === STPackageType.Webshops) {
                    // Already bought
                    return false
                }
                return true
            }
        }
        return false
    }

    /**
     * Create a new package for this type and return the pricing
     */
    static getCurrentPackage(bundle: STPackageBundle): STPackage {
        switch (bundle) {
            case STPackageBundle.Members: {
                // 1 year valid
                const renewAt = new Date()
                renewAt.setFullYear(renewAt.getFullYear() + 1)

                // Disable functions after 2 weeks
                const disableAt = new Date(renewAt)
                disableAt.setDate(disableAt.getDate() + 14)

                // Remove if not paid after 3 months
                const removeAt = new Date(renewAt)
                removeAt.setMonth(removeAt.getMonth() + 3)

                return STPackage.create({
                    renewAt,
                    disableAt,
                    removeAt,
                    meta: STPackageMeta.create({
                        type: STPackageType.Members,
                        price: 50,
                        amount: 59 * 2,
                        pricingType: STPricingType.PerMember
                    })
                })
            }

            case STPackageBundle.Webshops: {
                 // 1 year valid
                const renewAt = new Date()
                renewAt.setFullYear(renewAt.getFullYear() + 1)

                // Disable functions after 2 weeks
                const disableAt = new Date(renewAt)
                disableAt.setDate(disableAt.getDate() + 14)

                // Remove if not paid after 3 months
                const removeAt = new Date(renewAt)
                removeAt.setMonth(removeAt.getMonth() + 3)

                return STPackage.create({
                    renewAt,
                    disableAt,
                    removeAt,
                    meta: STPackageMeta.create({
                        type: STPackageType.Webshops,
                        price: 5900,
                        amount: 1,
                        pricingType: STPricingType.PerYear
                    })
                })
            }

            case STPackageBundle.SingleWebshop: {
                // Disable functions after two months
                const disableAt = new Date()
                disableAt.setMonth(disableAt.getMonth() + 2)

                return STPackage.create({
                    renewAt: null, // No renew allowed / needed
                    disableAt,
                    removeAt: null, // 
                    meta: STPackageMeta.create({
                        type: STPackageType.SingleWebshop,
                        price: 3900,
                        amount: 1,
                        pricingType: STPricingType.Fixed
                    })
                })
            }

            case STPackageBundle.TrialMembers: {
                // Disable functions after two weeks, manual reenable required
                const disableAt = new Date()
                disableAt.setDate(disableAt.getDate() + 14)

                return STPackage.create({
                    renewAt: null, // No renew allowed / needed
                    disableAt,
                    removeAt: disableAt, // remove at the same time
                    meta: STPackageMeta.create({
                        type: STPackageType.TrialMembers,
                        price: 0,
                        amount: 0,
                        pricingType: STPricingType.Fixed
                    })
                })
            }

            case STPackageBundle.TrialWebshops: {
                // Disable functions after two weeks, manual reenable required
                const disableAt = new Date()
                disableAt.setDate(disableAt.getDate() + 14)

                return STPackage.create({
                    renewAt: null, // No renew allowed / needed
                    disableAt,
                    removeAt: disableAt, // remove at the same time
                    meta: STPackageMeta.create({
                        type: STPackageType.TrialWebshops,
                        price: 0,
                        amount: 0,
                        pricingType: STPricingType.Fixed
                    })
                })
            }
        }

        throw new Error("Package not available")
    }
}