import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';

import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';

/**
 * Which details are collected from a person. The first and last name are always required.
 */
export class CustomerSettings extends AutoEncoder {
    @field({ decoder: new EnumDecoder(CustomerFieldRequirement) })
    email = CustomerFieldRequirement.Disabled;

    @field({ decoder: new EnumDecoder(CustomerFieldRequirement) })
    phone = CustomerFieldRequirement.Disabled;

    @field({ decoder: new EnumDecoder(CustomerFieldRequirement) })
    birthDay = CustomerFieldRequirement.Disabled;

    @field({ decoder: new EnumDecoder(CustomerFieldRequirement) })
    gender = CustomerFieldRequirement.Disabled;

    @field({ decoder: new EnumDecoder(CustomerFieldRequirement) })
    address = CustomerFieldRequirement.Disabled;
}
