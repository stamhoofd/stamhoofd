import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class KeychainItem extends AutoEncoder {
    /**
     * The user that owns this keychain item
     */
    @field({ decoder: StringDecoder })
    userId: string

    /**
     * The public key associated with the encrypted private key
     */
    @field({ decoder: StringDecoder })
    publicKey: string

    /**
     * The private key associated with the public key, encrypted with the user's public encryption key AND authenticated using the user's private encryption key
     */
    @field({ decoder: StringDecoder })
    encryptedPrivateKey: string
}