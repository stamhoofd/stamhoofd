import type { BaseOrganization, DetailedPayableBalance, Organization, OrganizationCheckout, OrganizationPackagesStatus, STPackage } from '@stamhoofd/structures';

export enum PayBalanceMode {
    /**
     * Required to pay the full outstanding balance
     */
    Required = 'Required',

    /**
     * User can choose what to pay.
     * By default everything is selected
     */
    Recommended = 'Recommended',

    /**
     * User can choose what to pay.
     * By default nothing is selected
     */
    Optional = 'Optional',

    /**
     * Not possible to pay from the balance
     */
    None = 'None'
}

/**
 * Only add data here that is absolutely required or that can help with making the views and steps more generic
 */
export class OrganizationCheckoutViewModel {
    checkout: OrganizationCheckout
    packageStatus: OrganizationPackagesStatus
    sellingOrganization: BaseOrganization
    payingOrganization: Organization
    packages: STPackage[]
    payableBalance: DetailedPayableBalance
    payBalanceMode = PayBalanceMode.Recommended

    forceNewMandate = false

    constructor(data: {
        checkout: OrganizationCheckout
        packageStatus: OrganizationPackagesStatus
        sellingOrganization: BaseOrganization,
        payingOrganization: Organization,
        payableBalance: DetailedPayableBalance,
        payBalanceMode: PayBalanceMode,
        forceNewMandate?: boolean
    }) {
        this.checkout = data.checkout
        this.packageStatus = data.packageStatus
        this.sellingOrganization = data.sellingOrganization
        this.payingOrganization = data.payingOrganization
        this.forceNewMandate = data.forceNewMandate ?? false
        this.payableBalance = data.payableBalance
        this.payBalanceMode = data.payBalanceMode
    }

    validate() {
        // This method might throw
        this.updatePackages()
    }

    /**
     * Returns the packages that will be activated in the end
     */
    updatePackages() {
        this.packages = this.checkout.purchases.getPackages(this.packageStatus);
    }

    get requiresMandate() {
        return this.forceNewMandate || this.packages.some(p => p.meta.requiresMandate)
    }

    get allowExistingMandates() {
        return !this.forceNewMandate
    }

    get paymentConfiguration() {
        return this.sellingOrganization.meta.registrationPaymentConfiguration
    }
}
