import { ArrayDecoder,AutoEncoder, AutoEncoderPatchType,Decoder,field, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { KeychainItem } from '../KeychainItem';
import { EncryptedMember } from '../members/EncryptedMember';

export class PatchMembers extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(EncryptedMember) })
    addMembers: EncryptedMember[]

    @field({ decoder: new ArrayDecoder(EncryptedMember) })
    updateMembers: EncryptedMember[]

    /**
     * Create or update the keychain items for these public keys (needs to be also present in addMembers or updateMembers)
     */
    @field({ decoder: new ArrayDecoder(KeychainItem)})
    keychainItems: KeychainItem[]
}