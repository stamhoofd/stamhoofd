import { KeyConstants } from "@stamhoofd/structures"

import { Sodium } from './Sodium'

export enum SensitivityLevel {
    Tests = "Tests",
    User = "User",
    Admin = "Admin"
}

export class KeyConstantsHelper {
    static async create(sensitivityLevel: SensitivityLevel): Promise<KeyConstants> {
        const sodium = await Sodium.getSodium()

        // Since the password hash needs to be generated on the client side, we use maximum operations
        // https://libsodium.gitbook.io/doc/password_hashing/default_phf#guidelines-for-choosing-the-parameters

        // For normal users we reduce memory needs because some older devices might crash if we try to allocate 1GB memory

        // Switched to interactive constants because it doesn't seem to work on Firefox with higher contants
        const opslimit = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE // Increase to make the generation of the key slower
        const memlimit = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
       
        const algo = sodium.crypto_pwhash_ALG_DEFAULT
        const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

        return KeyConstants.create({
            opslimit,
            memlimit,
            algo,
            salt: Buffer.from(salt).toString("base64")
        })
    }

    static async getSignKeyPair(constants: KeyConstants, password: string): Promise<{ publicKey: string; privateKey: string }> {
        if (constants.opslimit < 2 && STAMHOOFD.environment != "test") {
            throw new Error("These operation constants are too weak. Not going to use these.")
        }
        if (constants.memlimit < 64 * 1000 * 1000 && STAMHOOFD.environment != "test") {
            throw new Error("These memory constants are too weak. We are not going to use these.")
        }
        // Todo: validate salt, to check if it is not forged somehow
        const sodium = await Sodium.getSodium()

        const salt = Buffer.from(constants.salt, "base64")
        const opslimit = constants.opslimit // Increase to make the generation of the key slower
        const memlimit = constants.memlimit // in bytes
        const algo = constants.algo

        //console.log("Generating sign seed", salt, opslimit, memlimit, algo)
        const seed = sodium.crypto_pwhash(sodium.crypto_sign_SEEDBYTES, password, salt, opslimit, memlimit, algo, "uint8array")

        //console.log("Seeding keypair")
        const keypair = sodium.crypto_sign_seed_keypair(seed)

        return {
            publicKey: Buffer.from(keypair.publicKey).toString("base64"),
            privateKey: Buffer.from(keypair.privateKey).toString("base64"),
        }
    }

    static async getEncryptionKeyPair(constants: KeyConstants, password: string): Promise<{ publicKey: string; privateKey: string }> {
        if (constants.opslimit < 2 && STAMHOOFD.environment != "test") {
            throw new Error("These constants are too weak. Not going to use these.")
        }
        if (constants.memlimit < 64 * 1000 * 1000 && STAMHOOFD.environment != "test") {
            throw new Error("These constants are too weak. We are not going to use these.")
        }
        // Todo: validate salt, to check if it is not forged somehow

        const sodium = await Sodium.getSodium()

        const salt = Buffer.from(constants.salt, "base64")
        const opslimit = constants.opslimit // Increase to make the generation of the key slower
        const memlimit = constants.memlimit // in bytes
        const algo = constants.algo

        //console.log("Generating encryption seed")
        const seed = sodium.crypto_pwhash(sodium.crypto_box_SEEDBYTES, password, salt, opslimit, memlimit, algo, "uint8array")
        
        //console.log("Seeding keypair")
        const keypair = sodium.crypto_box_seed_keypair(seed)

        return {
            publicKey: Buffer.from(keypair.publicKey).toString("base64"),
            privateKey: Buffer.from(keypair.privateKey).toString("base64"),
        }
    }

    static async getEncryptionKey(constants: KeyConstants, password: string): Promise<string> {
        if (constants.opslimit < 2 && STAMHOOFD.environment != "test") {
            throw new Error("These constants are too weak. Not going to use these.")
        }
        if (constants.memlimit < 64 * 1000 * 1000 && STAMHOOFD.environment != "test") {
            throw new Error("These constants are too weak. We are not going to use these.")
        }
        // Todo: validate salt, to check if it is not forged somehow

        const sodium = await Sodium.getSodium()

        const salt = Buffer.from(constants.salt, "base64")
        const opslimit = constants.opslimit // Increase to make the generation of the key slower
        const memlimit = constants.memlimit // in bytes
        const algo = constants.algo

        //console.log("Generating encryption key")
        const key = sodium.crypto_pwhash(sodium.crypto_secretbox_KEYBYTES, password, salt, opslimit, memlimit, algo, "uint8array")
        return Buffer.from(key).toString("base64");
    }
}