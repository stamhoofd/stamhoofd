import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';

import { RecordCategory } from '../members/records/RecordCategory.js';
import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';

/**
 * Which customer details are collected for every cart item of a product with `enableCustomer`.
 * First and last name are always required.
 */
export class ProductCustomerSettings extends AutoEncoder {
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

    get hasAnyField() {
        return this.email !== CustomerFieldRequirement.Disabled
            || this.phone !== CustomerFieldRequirement.Disabled
            || this.birthDay !== CustomerFieldRequirement.Disabled
            || this.gender !== CustomerFieldRequirement.Disabled
            || this.address !== CustomerFieldRequirement.Disabled;
    }
}
