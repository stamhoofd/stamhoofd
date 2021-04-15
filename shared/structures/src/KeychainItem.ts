// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AutoEncoder, BaseIdentifiable, field, StringDecoder } from '@simonbackx/simple-encoding';

export class KeychainItem extends AutoEncoder implements BaseIdentifiable<string> {
    /**
     * Should be unique (by database constraint)
     */
    getIdentifier(): string {
        return this.publicKey
    }
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