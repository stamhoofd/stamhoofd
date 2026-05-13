import type { Organization, OrganizationPackagesStatus, PackageCheckout, STPackage } from '@stamhoofd/structures';

/**
 * Only add data here that is absolutely required or that can help with making the views and steps more generic
 */
export class PackageCheckoutViewModel {
    checkout: PackageCheckout
    packageStatus: OrganizationPackagesStatus
    sellingOrganization: Organization
    packages: STPackage[]

    constructor(data: {
        checkout: PackageCheckout
        packageStatus: OrganizationPackagesStatus
        sellingOrganization: Organization
    }) {
        this.checkout = data.checkout
        this.packageStatus = data.packageStatus
        this.sellingOrganization = data.sellingOrganization
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
        return this.packages.some(p => p.meta.requiresMandate)
    }

    get paymentConfiguration() {
        return this.sellingOrganization.meta.registrationPaymentConfiguration
    }
}
