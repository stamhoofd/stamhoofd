import { KeyConstantsHelper, SensitivityLevel, Sodium  } from "@stamhoofd/crypto"

// todo
const ctx: Worker = self as any;

async function generate(password: string) {
    console.log("Generating keys...");
    const userKeyPair = await Sodium.generateEncryptionKeyPair();
    const organizationKeyPair = await Sodium.generateEncryptionKeyPair();

    const authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Admin)
    const authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Admin)
    const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
    const authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage("todo");
}

ctx.addEventListener('message', (e) => {
    const password = e.data
    generate(password).catch(e => {
        console.error(e)
        throw e
    });
});