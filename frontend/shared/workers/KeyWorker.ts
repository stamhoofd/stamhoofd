import { Decoder,ObjectData } from '@simonbackx/simple-encoding';
import { KeyConstantsHelper, SensitivityLevel } from "@stamhoofd/crypto"
import { KeyConstants,Version } from '@stamhoofd/structures';

// todo
const ctx: Worker = self as any;

/**
 * Generate keys for challenge signing
 */
export async function generateSignKeys(password: string, authSignKeyConstants: KeyConstants) {
    console.log("Generating sign keys...");

    const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage(authSignKeyPair);
}

/**
 * Generate encryption key on successful sign in
 */
export async function generateEncryptionKey(password: string, authEncryptionKeyConstants: KeyConstants) {
    console.log("Generating encryption key...");

    const authEncryptionKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage(authEncryptionKey);
}

/**
 * Generate keys for a user sign-up
 */
export async function generateKeys(password: string) {
    console.log("Generating keys and constants...");

    // Sign keys are more sensitive, because they are the easiest to attack with a brute force attack
    const authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Admin)

    //console.log("Got sign contants. Next up: encryption key contants");
    const authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.User)

    //console.log("Got all contants. Next up: sign key pair");
    const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)

    //console.log("Got sign keys. Next up: encryption keys.");
    const authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage({
        authSignKeyConstants: authSignKeyConstants.encode({ version: Version }),
        authEncryptionKeyConstants: authEncryptionKeyConstants.encode({ version: Version }),
        authSignKeyPair,
        authEncryptionSecretKey
    });
}


ctx.onmessage = (e) => {
    //console.log("KeyWorker received a message")

    if (!e.data.type) {
        console.error("Expected type for key worker")
        throw new Error("Expected type for key worker")
    }

    switch (e.data.type) {
        case "signKeys": {
            const password = e.data.password
            const keyConstants = new ObjectData(e.data.authSignKeyConstants, {version: Version}).decode(KeyConstants as Decoder<KeyConstants>)
            generateSignKeys(password, keyConstants).catch(e => {
                // Need to do this to get the error back to the caller
                setTimeout(function () { throw e; }); 
            });
            return;
        }

        case "encryptionKey": {
            const password = e.data.password
            const keyConstants = new ObjectData(e.data.authEncryptionKeyConstants, {version: Version}).decode(KeyConstants as Decoder<KeyConstants>)
            generateEncryptionKey(password, keyConstants).catch(e => {
                // Need to do this to get the error back to the caller
                setTimeout(function () { throw e; }); 
            });
            return;
        }

        case "keys": {
            const password = e.data.password
            generateKeys(password).catch(e => {
                // Need to do this to get the error back to the caller
                setTimeout(function () { throw e; }); 
            });
            return;
        }

        case "status": {
            console.log("Received status check in worker")
            ctx.postMessage({
                status: "ok"
            })
            return;
        }

        default: {
            throw new Error("Unknown type "+e.data.type)
        }
    }
}