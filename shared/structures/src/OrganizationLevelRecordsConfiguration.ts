import type { Decoder } from '@common/encoding';
import { ArrayDecoder, AutoEncoder, field } from '@common/encoding';
import { RecordCategory } from './members/records/RecordCategory.js';
import type { ObjectWithRecords } from './members/ObjectWithRecords.js';

export class OrganizationLevelRecordsConfiguration extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>) })
    recordCategories: RecordCategory[] = [];

    getEnabledCategories<T extends ObjectWithRecords>(organization: T) {
        return this.recordCategories.filter(category => category.isEnabled(organization));
    }
}
