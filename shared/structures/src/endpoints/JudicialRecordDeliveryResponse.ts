import { AutoEncoder, EnumDecoder, field } from '@common/encoding';

import { JudicialRecordStatus } from '../helpers/JudicialRecordHelper.js';

export class JudicialRecordDeliveryResponse extends AutoEncoder {
    @field({ decoder: new EnumDecoder(JudicialRecordStatus) })
    status: JudicialRecordStatus;
}
