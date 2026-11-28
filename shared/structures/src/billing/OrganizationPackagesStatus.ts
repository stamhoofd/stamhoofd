import { ArrayDecoder, AutoEncoder, field } from '@stamhoofd/common-encoding';

import { STPackage } from './STPackage.js';

export class OrganizationPackagesStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(STPackage) })
    packages: STPackage[];
}
