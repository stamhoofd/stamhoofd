import { Decoder,ObjectData } from '@simonbackx/simple-encoding';
import { KeyConstantsHelper  } from "@stamhoofd/crypto"
import { KeyConstants,Version } from '@stamhoofd/structures';

// todo
const ctx: Worker = self as any;

async function generate(password: string, authEncryptionKeyConstants: KeyConstants) {
    console.log("Generating key...");

    const authEncryptionKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
    
    console.log("Done.");
    ctx.postMessage(authEncryptionKey);
}

ctx.addEventListener('message', (e) => {
    const password = e.data.password
    const keyConstants = new ObjectData(e.data.authEncryptionKeyConstants, {version: Version}).decode(KeyConstants as Decoder<KeyConstants>)
    generate(password, keyConstants).catch(e => {
        // Need to do this to get the error back to the caller
        setTimeout(function () { throw e; }); 
    });
});