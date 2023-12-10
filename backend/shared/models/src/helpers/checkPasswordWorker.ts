import { KeyConstantsHelper, Sodium } from "@stamhoofd/crypto";
import { KeyConstants } from "@stamhoofd/structures";
import { parentPort,workerData } from 'worker_threads';

(async function() {
    console.log('[WORKER] Checking password for ', workerData.email);
    const password = workerData.password;
    const authSignKeyConstants = workerData.keyConstants;
    const publicAuthSignKey = workerData.publicAuthSignKey;

    const authSignKeys = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants as KeyConstants, password as string)
    console.log('[WORKER] Got keys for password', authSignKeys)
    parentPort?.postMessage(await Sodium.isMatchingSignPublicPrivate(publicAuthSignKey as string, authSignKeys.privateKey));
})().catch((e) => {
    console.error('[WORKER ERROR]', e);
    parentPort?.postMessage(false);
})