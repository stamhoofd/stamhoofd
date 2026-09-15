import { field } from '@simonbackx/simple-encoding';

import { RecordCategory } from '../members/records/RecordCategory.js';
import { CustomerSettings } from './CustomerSettings.js';

/**
 * Which customer details are collected for every cart item of a product with `enableCustomer`.
 */
export class ProductCustomerSettings extends CustomerSettings {
    /**
     * Extra questions, listed inline with the customer inputs
     */
    @field({ decoder: RecordCategory, nullable: true })
    recordCategory: RecordCategory | null = null;
}
