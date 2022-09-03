import { KeyConstantsHelper, Sodium } from "@stamhoofd/crypto";

import { workerData, parentPort } from 'worker_threads';

(async function() {
    console.log('[WORKER] Checking password for ', workerData.email);
    const password = workerData.password;
    const authSignKeyConstants = workerData.keyConstants;
    const publicAuthSignKey = workerData.publicAuthSignKey;

    const authSignKeys = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
    console.log('[WORKER] Got keys for password', authSignKeys)
    parentPort?.postMessage(await Sodium.isMatchingSignPublicPrivate(publicAuthSignKey, authSignKeys.privateKey));
})().catch((e) => {
    console.error('[WORKER ERROR]', e);
    parentPort?.postMessage(false);
})