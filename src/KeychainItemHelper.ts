import { DecodingError } from "@simonbackx/simple-encoding"
import { KeychainItem } from "@stamhoofd/structures"

import { Sodium } from "./Sodium"

export class KeychainItemHelper {
    static async validate(item: KeychainItem) {
        // Test lengths of all the keys
        const pk = Buffer.from(item.publicKey, "base64")

        if (pk.length != await Sodium.getBoxPublicKeyBytes()) {
            throw new DecodingError({
                code: "invalid_field",
                message: "The length of the public key is not valid",
                field: "publicKey"
            })
        }
        const esk = Buffer.from(item.encryptedPrivateKey, "base64")
        const expectedBytes = await Sodium.getBoxEncryptedPrivateKeyBytes()
        if (esk.length != expectedBytes) {
            throw new DecodingError({
                code: "invalid_field",
                message: "The length of the encrypted private key is not valid. Expected " + expectedBytes + ", received " + esk.length,
                field: "encryptedPrivateKey"
            })
        }
    }
}