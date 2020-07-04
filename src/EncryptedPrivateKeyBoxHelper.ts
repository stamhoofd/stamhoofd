import { EncryptedPrivateKeyBox } from "@stamhoofd/structures"
import sodium from "libsodium-wrappers";

import { Sodium } from './Sodium'

export class EncryptedPrivateKeyBoxHelper {
    static async encrypt(privateKey: string, password: string): Promise<EncryptedPrivateKeyBox> {
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

        return EncryptedPrivateKeyBox.create({
            opslimit,
            memlimit,
            algo,
            salt: Buffer.from(salt).toString("base64"),
            nonce: Buffer.from(nonce).toString("base64"),
            encryptedPrivateKey: Buffer.from(encryptedPrivateKey).toString("base64")
        })
    }

    /** Decrypt the encrypted private key with the given password */
    static async decrypt(encryptedPrivateKeyBox: EncryptedPrivateKeyBox, password: string): Promise<string> {
        await Sodium.loadIfNeeded();

        const salt = Buffer.from(encryptedPrivateKeyBox.salt, "base64")
        const nonce = Buffer.from(encryptedPrivateKeyBox.nonce, "base64")
        const encryptedPrivateKey = Buffer.from(encryptedPrivateKeyBox.encryptedPrivateKey, "base64")

        // Step 1: recreate the password hash
        const key = sodium.crypto_pwhash(sodium.crypto_secretbox_KEYBYTES, password, salt, encryptedPrivateKeyBox.opslimit, encryptedPrivateKeyBox.memlimit, encryptedPrivateKeyBox.algo, "uint8array")

        // This should be the same already (we'll see if authentication or decryption fails)

        return Buffer.from(sodium.crypto_secretbox_open_easy(encryptedPrivateKey, nonce, key)).toString("base64")
    }
}