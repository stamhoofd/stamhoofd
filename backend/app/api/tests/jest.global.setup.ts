import backendEnv from '@stamhoofd/backend-env';
backendEnv.load({ path: __dirname + '/../../.env.test.json' });

import { Database, Migration } from '@simonbackx/simple-database';
import * as jose from 'jose';
import nock from 'nock';
import path from 'path';
import { GlobalHelper } from '../src/helpers/GlobalHelper';
const emailPath = require.resolve('@stamhoofd/email');
const modelsPath = require.resolve('@stamhoofd/models');

// Disable network requests
nock.disableNetConnect();

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export default async () => {
    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + '/migrations');
    await Migration.runAll(path.dirname(emailPath) + '/migrations');

    // Internal
    await Migration.runAll(__dirname + '/src/migrations');

    await Database.end();

    // Use random file keys in tests
    const alg = 'ES256';
    (STAMHOOFD as any).FILE_SIGNING_ALG = alg;

    const { publicKey, privateKey } = await jose.generateKeyPair(alg);

    const exportedPublicKey = await jose.exportJWK(publicKey);
    const exportedPrivateKey = await jose.exportJWK(privateKey);

    (STAMHOOFD as any).FILE_SIGNING_PUBLIC_KEY = exportedPublicKey;
    (STAMHOOFD as any).FILE_SIGNING_PRIVATE_KEY = exportedPrivateKey;

    await GlobalHelper.load();
};
