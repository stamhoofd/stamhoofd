import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding'

/// To prevent any circular dependencies, all encryption methods for EncryptedPrivateKey are stored in @stamhoofd/crypto
export class EncryptedPrivateKeyBox extends AutoEncoder {
    /**
     * opslimit used to generate the key from the password
     */
    @field({ decoder: IntegerDecoder })
    opslimit: number

    /**
     * memlimit used to generate the key from the password
     */
    @field({ decoder: IntegerDecoder })
    memlimit: number

    /**
     * algo used to generate the key from the password
     */
    @field({ decoder: IntegerDecoder })
    algo: number

    /**
     * Salt used to generate the key from the password
     */
    @field({ decoder: StringDecoder })
    salt: string

    /**
     * Nonce used to encrypt the private key with the generated secret key (from the password)
     */
    @field({ decoder: StringDecoder })
    nonce: string

    /**
     * Resulting encrypted private key
     */
    @field({ decoder: StringDecoder })
    encryptedPrivateKey: string
}