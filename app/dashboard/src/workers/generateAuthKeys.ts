import { KeyConstantsHelper, SensitivityLevel, Sodium  } from "@stamhoofd/crypto"
import { KeyConstants,Version } from '@stamhoofd/structures';

// todo
const ctx: Worker = self as any;

async function generate(password: string) {
    console.log("Generating keys...");
    const userKeyPair = await Sodium.generateEncryptionKeyPair();
    const organizationKeyPair = await Sodium.generateEncryptionKeyPair();

    let authSignKeyConstants: KeyConstants
    let authEncryptionKeyConstants: KeyConstants

    if (process.env.NODE_ENV != "production") {
        authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.User)
        authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.User)
    } else {
         authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Admin)
         authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Admin)
    }

    const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
    const authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage({
        userKeyPair,
        organizationKeyPair,
        authSignKeyConstants: authSignKeyConstants.encode({ version: Version }),
        authEncryptionKeyConstants: authEncryptionKeyConstants.encode({ version: Version }),
        authSignKeyPair,
        authEncryptionSecretKey
    });
}

ctx.addEventListener('message', (e) => {
    const password = e.data
    generate(password).catch(e => {
        // Need to do this to get the error back to the caller
        setTimeout(function () { throw e; }); 
    });
});