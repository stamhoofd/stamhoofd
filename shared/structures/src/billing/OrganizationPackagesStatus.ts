import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { STPackage } from './STPackage.js';

export class OrganizationPackagesStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(STPackage) })
    packages: STPackage[];
}
