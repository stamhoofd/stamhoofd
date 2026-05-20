import { ArrayDecoder, AutoEncoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { STPackageBundle, STPackageBundleHelper } from '../billing/STPackageBundle.js';
import { Checkoutable } from './Checkoutable.js';
import type { OrganizationPackagesStatus } from '../billing/OrganizationPackagesStatus.js';
import type { STPackage } from '../billing/STPackage.js';
import { SimpleError } from '@simonbackx/simple-errors';

/**
 * Checkout flow between organizations
 */
export class PackagePurchases extends AutoEncoder {
    /**
     * Buy or activate new packges.
     * If the package already exists, the backend will map it automatically to a renewal.
     */
    @field({ decoder: new ArrayDecoder(new EnumDecoder(STPackageBundle)) })
    packageBundles: STPackageBundle[] = [];

    /**
     * Renew existing packages explicitly
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    renewPackageIds: string[] = [];

    get empty() {
        return this.packageBundles.length === 0 && this.renewPackageIds.length === 0;
    }

    /**
     * Calculate the actual packages we'll activate
     */
    getPackages(currentPackages: OrganizationPackagesStatus): STPackage[] {
        const packages: STPackage[] = [];

        // Renewals
        for (const id of this.renewPackageIds) {
            const pack = currentPackages.packages.find(c => c.id === id);
            if (!pack) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Package not found',
                    human: $t('%1L1'),
                });
            }
            const renewed = pack.createRenewed();

            packages.push(renewed);
        }

        for (const bundle of this.packageBundles) {
            // Renew after currently running packages
            let date = new Date();

            let skip = false;

            // Do we have a collision? Make sure our package only start after the expiry date of existing packages
            for (const currentPack of [...currentPackages.packages, ...packages]) {
                if (!STPackageBundleHelper.isCombineable(bundle, currentPack)) {
                    if (!STPackageBundleHelper.isStackable(bundle, currentPack)) {
                        // We skip silently
                        console.error('Tried to activate non combineable, non stackable packages...');
                        skip = true;
                        continue;
                    }
                    if (currentPack.endDate !== null) {
                        const end = currentPack.endDate;
                        if (end > date) {
                            date = end;
                        }
                    } else {
                        // Non-expiring
                        throw new SimpleError({
                            code: 'already_active',
                            message: 'Cannot activate this package because of conflicting package',
                            human: $t('%1Qa')
                        })
                    }
                }
            }

            if (skip) {
                continue;
            }
            packages.push(STPackageBundleHelper.getCurrentPackage(bundle, date));
        }

        // Remove all packages that would be valid for more than 2 years in the future
        // This prevents renewing 2 years in a row
        for (const pack of packages) {
            if (pack.validUntil && pack.validUntil.getTime() > new Date().getTime() + 1000 * 60 * 60 * 24 * 365 * 2) {
                throw new SimpleError({
                    code: 'invalid_package',
                    message: 'Package valid until date is too far in the future',
                    human: $t('%1Sv')
                });
            }
        }

        return packages;
    }
}

export class OrganizationCheckout extends Checkoutable<PackagePurchases> {
    @field({ decoder: PackagePurchases })
    purchases: PackagePurchases;
}
