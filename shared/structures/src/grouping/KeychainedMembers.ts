import { AnyDecoder, ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Member } from '../members/Member';

/**
 * Equivalent of KeychainedResponse, but this one is patchable and used by the patchusermembers endpoint
 */
export class KeychainedMembers extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Member) })
    members: Member[]

    /**
     * @deprecated
     * Can get dropped after a few months
     */
    @field({ decoder: new ArrayDecoder(AnyDecoder), optional: true })
    keychainItems: never[] = []
}