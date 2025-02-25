import backendEnv from '@stamhoofd/backend-env';
backendEnv.load({ path: __dirname + '/../../.env.test.json' });

import { Column, Database } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { Email } from '@stamhoofd/email';
import { Version } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';
import nock from 'nock';
import { GlobalHelper } from '../src/helpers/GlobalHelper';
import * as jose from 'jose';

// Set version of saved structures
Column.setJSONVersion(Version);

// Disable network requests
nock.disableNetConnect();

// Automatically set endpoint default version to latest one (only in tests!)
Request.defaultVersion = Version;

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

console.log = jest.fn();

beforeAll(async () => {
    nock.cleanAll();
    nock.disableNetConnect();

    await Database.delete('DELETE FROM `tokens`');
    await Database.delete('DELETE FROM `users`');
    await Database.delete('DELETE FROM `registrations`');
    await Database.delete('DELETE FROM `members`');
    await Database.delete('DELETE FROM `postal_codes`');
    await Database.delete('DELETE FROM `cities`');
    await Database.delete('DELETE FROM `provinces`');

    await Database.delete('DELETE FROM `webshop_orders`');
    await Database.delete('DELETE FROM `webshops`');
    await Database.delete('DELETE FROM `groups`');
    await Database.delete('DELETE FROM `email_addresses`');

    await Database.delete('DELETE FROM `organizations`');

    await Database.delete('DELETE FROM `payments`');
    await Database.delete('OPTIMIZE TABLE organizations;'); // fix breaking of indexes due to deletes (mysql bug?)

    // Resetting environment
    (STAMHOOFD as any).userMode = 'organization';

    // Use random file keys in tests
    const alg = 'ES256';
    (STAMHOOFD as any).FILE_SIGNING_ALG = alg;

    const { publicKey, privateKey } = await jose.generateKeyPair(alg);

    const exportedPublicKey = await jose.exportJWK(publicKey);
    const exportedPrivateKey = await jose.exportJWK(privateKey);

    (STAMHOOFD as any).FILE_SIGNING_PUBLIC_KEY = exportedPublicKey;
    (STAMHOOFD as any).FILE_SIGNING_PRIVATE_KEY = exportedPrivateKey;

    await GlobalHelper.load();
});

afterAll(async () => {
    // Wait for email queue etc
    while (Email.currentQueue.length > 0) {
        console.info('Emails still in queue. Waiting...');
        await sleep(100);
    }
    await Database.end();
});
