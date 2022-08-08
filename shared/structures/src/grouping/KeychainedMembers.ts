import { ArrayDecoder,AutoEncoder, field } from '@simonbackx/simple-encoding';

import { KeychainItem } from '../KeychainItem';
import { Member } from '../members/Member';

/**
 * Equivalent of KeychainedResponse, but this one is patchable and used by the patchusermembers endpoint
 */
export class KeychainedMembers extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Member) })
    members: Member[]

    /**
     * Create or update the keychain items for these public keys (needs to be also present in addMembers or updateMembers)
     */
    @field({ decoder: new ArrayDecoder(KeychainItem)})
    keychainItems: KeychainItem[]
}