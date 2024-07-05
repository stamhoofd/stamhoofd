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
            case STPackageBundle.Webshops: return "Webshops voor één jaar"
            case STPackageBundle.SingleWebshop: return "Eén webshop voor 3 maanden (Starter)"
        }
        return "?"
    }

    static getDescription(bundle: STPackageBundle): string {
        switch(bundle) {
            case STPackageBundle.Members: return "€ 0,5 per jaar, per lid. Minimum € 59 per jaar (minder leden kan uiteraard)"
            case STPackageBundle.Webshops: return "€ 59 per jaar (inclusief ticketverkoop-functie) indien minder dan 50.000 euro omzet per jaar"
            case STPackageBundle.SingleWebshop: return "Eénmalig € 49 (inclusief ticketverkoop-functie)"
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

    /**
     * If you buy a package that is not combineable with an existing one, should it throw an error?
     */
    static isStackable(bundle: STPackageBundle, pack: STPackage): boolean {
        switch(bundle) {
            case STPackageBundle.TrialMembers: {
                // Not allowed to start a trial even if pack is expired
                return false
            }
            case STPackageBundle.TrialWebshops: {
                // Not allowed to start a trial again if pack is expired
                return false
            }
        }
        return true
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
                if (pack.meta.type === STPackageType.Members || pack.meta.type === STPackageType.TrialMembers) {
                    // Already bought
                    return false
                }
                return true
            }
            case STPackageBundle.TrialWebshops: {
                if (pack.meta.type === STPackageType.SingleWebshop || pack.meta.type === STPackageType.Webshops || pack.meta.type === STPackageType.TrialWebshops) {
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
    static getCurrentPackage(bundle: STPackageBundle, date: Date): STPackage {
        switch (bundle) {
            case STPackageBundle.Members: {
                // 1 year valid
                const validUntil = new Date(date)
                validUntil.setFullYear(validUntil.getFullYear() + 1)

                // Remove (= not renewable) if not renewed after 1 month
                const removeAt = new Date(validUntil)
                removeAt.setMonth(removeAt.getMonth() + 1)

                return STPackage.create({
                    validUntil,
                    removeAt,
                    meta: STPackageMeta.create({
                        type: STPackageType.Members,
                        unitPrice: 50,
                        minimumAmount: 59*2,
                        allowRenew: true,
                        pricingType: STPricingType.PerMember,
                        startDate: new Date(date),
                    })
                })
            }

            case STPackageBundle.Webshops: {
                // 1 year valid
                const validUntil = new Date(date)
                validUntil.setFullYear(validUntil.getFullYear() + 1)

                // Remove (= not renewable) if not renewed after 1 month
                const removeAt = new Date(validUntil)
                removeAt.setMonth(removeAt.getMonth() + 1)

                return STPackage.create({
                    validUntil,
                    removeAt,
                    meta: STPackageMeta.create({
                        type: STPackageType.Webshops,
                        unitPrice: 5900,
                        minimumAmount: 1,
                        allowRenew: true,
                        pricingType: STPricingType.PerYear,
                        startDate: new Date(date)
                    })
                })
            }

            case STPackageBundle.SingleWebshop: {
                // Disable functions after two months
                const validUntil = new Date(date)
                validUntil.setMonth(validUntil.getMonth() + 2)

                // Remove if not valid anymore
                const removeAt = new Date(validUntil)

                return STPackage.create({
                    validUntil,
                    removeAt,
                    meta: STPackageMeta.create({
                        type: STPackageType.SingleWebshop,
                        unitPrice: 4900,
                        minimumAmount: 1,
                        allowRenew: true,
                        pricingType: STPricingType.Fixed,
                        startDate: new Date(date)
                    })
                })
            }

            case STPackageBundle.TrialMembers: {
                // Disable functions after two weeks, manual reenable required
                const validUntil = new Date(date)
                validUntil.setDate(validUntil.getDate() + 14)

                // Remove if not valid anymore
                const removeAt = new Date(validUntil)

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
                        canDeactivate: true
                    })
                })
            }

            case STPackageBundle.TrialWebshops: {
                 // Disable functions after two weeks, manual reenable required
                const validUntil = new Date(date)
                validUntil.setDate(validUntil.getDate() + 14)

                // Remove if not valid anymore
                const removeAt = new Date(validUntil)

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
                        canDeactivate: true
                    })
                })
            }
        }

        throw new Error("Package not available")
    }
}