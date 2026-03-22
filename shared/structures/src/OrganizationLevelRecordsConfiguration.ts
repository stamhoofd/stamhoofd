import type { Decoder} from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';
import { RecordCategory } from './members/records/RecordCategory.js';
import type { Organization } from './Organization.js';

export class OrganizationLevelRecordsConfiguration extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>) })
    recordCategories: RecordCategory[] = [];

    getEnabledCategories(organization: Organization) {
        return this.recordCategories.filter(category => category.isEnabled(organization));
    }
}
