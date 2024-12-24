// todo: change name, but: confusion with OrganizationRecordsConfiguration

import { ArrayDecoder, AutoEncoder, Decoder, field } from '@simonbackx/simple-encoding';
import { RecordCategory } from './members/records/RecordCategory';

export class OrganizationLvlRecordsConfiguration extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>), ...NextVersion })
    recordCategories: RecordCategory[] = [];
}
