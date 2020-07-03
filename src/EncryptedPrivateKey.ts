import { AutoEncoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"
import sodium from "libsodium-wrappers";

import { Sodium } from './Sodium'

export class EncryptedPrivateKey extends AutoEncoder {
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

    static async encrypt(privateKey: string, password: string): Promise<EncryptedPrivateKey> {
        await Sodium.loadIfNeeded();

        const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

        // Since the password hash needs to be generated on the client side, we use maximum operations

        // https://libsodium.gitbook.io/doc/password_hashing/default_phf#guidelines-for-choosing-the-parameters
        const opslimit = 10 // Increase to make the generation of the key slower
        const memlimit = 64 * 1000 * 1000 // in bytes
        const algo = sodium.crypto_pwhash_ALG_ARGON2ID13

        const key = sodium.crypto_pwhash(sodium.crypto_secretbox_KEYBYTES, password, salt, opslimit, memlimit, algo, "uint8array")

        // Now encrypt the private key with the key we just created
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

        const encryptedPrivateKey = sodium.crypto_secretbox_easy(Buffer.from(privateKey, "base64"), nonce, key)

        return EncryptedPrivateKey.create({
            opslimit,
            memlimit,
            algo,
            salt: Buffer.from(salt).toString("base64"),
            nonce: Buffer.from(nonce).toString("base64"),
            encryptedPrivateKey: Buffer.from(encryptedPrivateKey).toString("base64")
        })
    }

    /** Decrypt the encrypted private key with the given password */
    async decrypt(password: string): Promise<string> {
        await Sodium.loadIfNeeded();

        const salt = Buffer.from(this.salt, "base64")
        const nonce = Buffer.from(this.nonce, "base64")
        const encryptedPrivateKey = Buffer.from(this.encryptedPrivateKey, "base64")

        // Step 1: recreate the password hash
        const key = sodium.crypto_pwhash(sodium.crypto_secretbox_KEYBYTES, password, salt, this.opslimit, this.memlimit, this.algo, "uint8array")

        // This should be the same already (we'll see if authentication or decryption fails)

        return Buffer.from(sodium.crypto_secretbox_open_easy(encryptedPrivateKey, nonce, key)).toString("base64")
    }
}