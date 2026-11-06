import { AutoEncoder, EnumDecoder, field } from '@common/encoding';

import { JudicialRecordDeliveryStatus } from '../members/JudicialRecordDeliveryStatus.js';

/**
 * What delivering an extract from the judicial record left behind.
 *
 * A struct around a single enum, because the status over the wire has to be able to grow a field —
 * which reviewer picked it up, when it was accepted — and a bare string cannot be versioned.
 */
export class JudicialRecordDeliveryResponse extends AutoEncoder {
    @field({ decoder: new EnumDecoder(JudicialRecordDeliveryStatus) })
    status: JudicialRecordDeliveryStatus;
}
