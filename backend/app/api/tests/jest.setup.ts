// first import nock
import nock from 'nock';

import { Column, Database } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email, EmailMocker } from '@stamhoofd/email';
import { QueueHandler } from '@stamhoofd/queues';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { sleep } from '@stamhoofd/utility';
import * as jose from 'jose';
import { GlobalHelper } from '../src/helpers/GlobalHelper.js';
import { BalanceItemService } from '../src/services/BalanceItemService.js';
import { PayconiqMocker } from './helpers/PayconiqMocker.js';
import './toMatchMap.js';

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
    await Database.delete('DELETE FROM `email_recipients`');
    await Database.delete('DELETE FROM `emails`');
    await Database.delete('DELETE FROM `email_templates`');

    await Database.delete('DELETE FROM `webshop_orders`');
    await Database.delete('DELETE FROM `webshops`');
    await Database.delete('DELETE FROM `groups`');
    await Database.delete('DELETE FROM `email_addresses`');
    await Database.update('UPDATE registration_periods set organizationId = null, customName = ? where organizationId is not null', ['delete']);
    await Database.delete('DELETE FROM `organizations`');
    await Database.delete('DELETE FROM `registration_periods` where customName = ?', ['delete']);

    await Database.delete('DELETE FROM `payments`');
    await Database.delete('OPTIMIZE TABLE organizations;'); // fix breaking of indexes due to deletes (mysql bug?)

    // Use random file keys in tests
    const alg = 'ES256';
    (STAMHOOFD as any).FILE_SIGNING_ALG = alg;

    const { publicKey, privateKey } = await jose.generateKeyPair(alg);

    const exportedPublicKey = await jose.exportJWK(publicKey);
    const exportedPrivateKey = await jose.exportJWK(privateKey);

    TestUtils.setPermanentEnvironment('FILE_SIGNING_PUBLIC_KEY', exportedPublicKey);
    TestUtils.setPermanentEnvironment('FILE_SIGNING_PRIVATE_KEY', exportedPrivateKey);

    await GlobalHelper.load();

    // Override default $t handlers
    await TestUtils.loadEnvironment();
});

afterAll(async () => {
    // Call twice to also wait on items that are scheduled withing scheduled tasks
    await BalanceItemService.flushAll();
    await BalanceItemService.flushAll();
    QueueHandler.abortAll(
        new SimpleError({
            code: 'SHUTDOWN',
            message: 'Shutting down',
            statusCode: 503,
        }),
    );
    await QueueHandler.awaitAll();
    QueueHandler.abortAll(
        new SimpleError({
            code: 'SHUTDOWN',
            message: 'Shutting down',
            statusCode: 503,
        }),
    );
    await QueueHandler.awaitAll();

    // Wait for email queue etc
    while (Email.currentQueue.length > 0) {
        console.info('Emails still in queue. Waiting...');
        await sleep(100);
    }
    await Database.end();
});

afterEach(async () => {
    await QueueHandler.awaitAll();
});

TestUtils.setup();
EmailMocker.infect();
PayconiqMocker.infect();
