import { ArrayDecoder, AutoEncoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { STPackageBundle } from '../billing/STPackageBundle.js';
import { Checkoutable } from './Checkoutable.js';

/**
 * Checkout flow between organizations
 */
export class PackagePurchases extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(new EnumDecoder(STPackageBundle)) })
    packageBundles: STPackageBundle[] = [];

    /**
     * Renew existing packages
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    renewPackageIds: string[] = [];
}

export class PackageCheckout extends Checkoutable<PackagePurchases> {
    @field({ decoder: PackagePurchases })
    purchases: PackagePurchases;
}
