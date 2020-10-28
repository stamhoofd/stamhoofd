import { Decoder,ObjectData } from '@simonbackx/simple-encoding';
import { KeyConstantsHelper, SensitivityLevel } from "@stamhoofd/crypto"
import { KeyConstants,Version } from '@stamhoofd/structures';

// todo
const ctx: Worker = self as any;

/**
 * Generate keys for challenge signing
 */
async function generateSignKeys(password: string, authSignKeyConstants: KeyConstants) {
    console.log("Generating sign keys...");

    const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage(authSignKeyPair);
}

/**
 * Generate encryption key on successful sign in
 */
async function generateEncryptionKey(password: string, authEncryptionKeyConstants: KeyConstants) {
    console.log("Generating encryption key...");

    const authEncryptionKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage(authEncryptionKey);
}

/**
 * Generate keys for a user sign-up
 */
async function generateKeys(password: string) {
    console.log("Generating keys and constants...");

    const authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.User)
    const authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.User)

    const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
    const authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage({
        authSignKeyConstants: authSignKeyConstants.encode({ version: Version }),
        authEncryptionKeyConstants: authEncryptionKeyConstants.encode({ version: Version }),
        authSignKeyPair,
        authEncryptionSecretKey
    });
}


ctx.addEventListener('message', (e) => {
    if (!e.data.type) {
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

        default: {
            throw new Error("Unknown type "+e.data.type)
        }
    }

});