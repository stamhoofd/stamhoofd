import { ArrayDecoder, AutoEncoder, field } from '@common/encoding';

import { STPackage } from './STPackage.js';

export class OrganizationPackagesStatus extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(STPackage) })
    packages: STPackage[];
}
