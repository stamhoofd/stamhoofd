import { STPackage, STPackageMeta, STPackageType, STPricingType } from "./STPackage"

/**
 * Package bundle are packages that you can buy
 */
export enum STPackageBundle {
    // Webshop package (max 10 webshops)
    "Webshops" = "Webshops",
    
    // Full members package
    "Members" = "Members",

    // One webshop package (max 1 webshop)
    "SingleWebshop" = "SingleWebshop",

    "TrialMembers" = "TrialMembers",
    "TrialWebshops" = "TrialWebshops",
}

export class STPackageBundleHelper {
    static getTitle(bundle: STPackageBundle): string {
        switch(bundle) {
            case STPackageBundle.Members: return "Ledenadministratie"
            case STPackageBundle.Webshops: return "Webshops, ticketverkoop en openbare inschrijvingen"
        }
        return "?"
    }

    static getDescription(bundle: STPackageBundle): string {
        switch(bundle) {
            case STPackageBundle.Members: return "Beheer je leden overzichtelijk, houd gegevens netjes bij en geef hen toegang tot jullie eigen ledenportaal om hun gegevens te beheren of inschrijvingen te doen."
            case STPackageBundle.Webshops: return "Verkoop tickets, inschrijvingen, merchandising en meer via één of meerdere webshops."
        }
        return "?"
    }

    static isPublic(bundle: STPackageBundle): boolean {
        switch(bundle) {
            case STPackageBundle.Members: return true;
            case STPackageBundle.Webshops: return true;
        }
        return false
    }

    static requiresMandate(bundle: STPackageBundle): boolean {
        switch(bundle) {
            case STPackageBundle.Members: return true;
            case STPackageBundle.Webshops: return true;
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

    static isAlreadyBought(bundle: STPackageBundle, pack: STPackage): boolean {
        switch(bundle) {
            case STPackageBundle.Members: {
                if (pack.meta.type === STPackageType.Members) {
                    // Already bought
                    return true
                }
                return false
            }
            case STPackageBundle.Webshops: {
                if (pack.meta.type === STPackageType.Webshops) {
                    // Already bought
                    return true
                }
                if (pack.meta.type === STPackageType.SingleWebshop) {
                    // Already bought
                    return true
                }
                return false
            }
            case STPackageBundle.SingleWebshop: {
                if (pack.meta.type === STPackageType.SingleWebshop || pack.meta.type === STPackageType.Webshops) {
                    // Already bought
                    return true
                }
                return false
            }
        }
        return false
    }

    static isInTrial(bundle: STPackageBundle, pack: STPackage): boolean {
        switch(bundle) {
            case STPackageBundle.Members: {
                if (pack.meta.type === STPackageType.TrialMembers) {
                    // Already bought
                    return true
                }
                return false
            }
            case STPackageBundle.Webshops: {
                if (pack.meta.type === STPackageType.TrialWebshops) {
                    // Already bought
                    return true
                }
                return false
            }
            case STPackageBundle.SingleWebshop: {
                if (pack.meta.type === STPackageType.TrialWebshops) {
                    // Already bought
                    return true
                }
                return false
            }
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
                return STPackage.create({
                    validUntil: null,
                    removeAt: null,
                    meta: STPackageMeta.create({
                        type: STPackageType.Members,
                        unitPrice: 0,
                        minimumAmount: 0,
                        allowRenew: false,
                        pricingType: STPricingType.Fixed,
                        serviceFeeFixed: 0,
                        serviceFeePercentage: 1_00,
                        serviceFeeMaximum: 95,
                        startDate: new Date(date),
                        canDeactivate: true
                    })
                })
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
                        serviceFeePercentageTickets: 3_00,
                        serviceFeeMinimumTickets: 15,
                        serviceFeeMaximum: 95,
                        serviceFeeMaximumTickets: 1_95,
                        startDate: new Date(date),
                        canDeactivate: true
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