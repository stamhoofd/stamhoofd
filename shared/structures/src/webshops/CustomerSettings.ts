import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';

import { RecordCategory } from '../members/records/RecordCategory.js';
import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';

/**
 * Which details are collected from a person.
 */
export class CustomerSettings extends AutoEncoder {
    @field({ decoder: new EnumDecoder(CustomerFieldRequirement) })
    name = CustomerFieldRequirement.Required;

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

    /**
     * Extra questions, listed inline with the customer inputs
     */
    @field({ decoder: RecordCategory, nullable: true })
    recordCategory: RecordCategory | null = null;
}
