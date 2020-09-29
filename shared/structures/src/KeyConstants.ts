import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding'

/// To prevent any circular dependencies, all encryption methods for EncryptedPrivateKey are stored in @stamhoofd/crypto
export class KeyConstants extends AutoEncoder {
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
}