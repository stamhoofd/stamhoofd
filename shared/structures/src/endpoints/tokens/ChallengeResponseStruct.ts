import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { KeyConstants } from '../../KeyConstants';

/// Only used as input
export class ChallengeResponseStruct extends AutoEncoder {
    @field({ decoder: StringDecoder })
    challenge: string

    @field({ decoder: KeyConstants })
    keyConstants: KeyConstants
}