import backendEnv from '@stamhoofd/backend-env';
import { TestUtils } from '@stamhoofd/test-utils';
import path from 'path';

backendEnv.load({ path: __dirname + '/../../.env.test.json' });

import { Database, Migration } from '@simonbackx/simple-database';
import { EmailMocker } from '@stamhoofd/email';
const modelsPath = require.resolve('@stamhoofd/models');
const emailPath = require.resolve('@stamhoofd/email');

export default async () => {
    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + '/migrations');
    await Migration.runAll(path.dirname(emailPath) + '/migrations');

    await TestUtils.globalSetup();

    await Database.delete('DELETE FROM `users`');
    await Database.delete('DELETE FROM `tokens`');
    await Database.delete('DELETE FROM `users`');
    await Database.delete('DELETE FROM `registrations`');
    await Database.delete('DELETE FROM `payments`');
    await Database.delete('DELETE FROM `members`');
    await Database.delete('DELETE FROM `organizations`');
    await Database.delete('DELETE FROM `email_recipients`');
    await Database.delete('DELETE FROM `emails`');
    await Database.delete('DELETE FROM `email_addresses`');
    await Database.delete('DELETE FROM `postal_codes`');
    await Database.delete('DELETE FROM `cities`');
    await Database.delete('DELETE FROM `provinces`');

    await Database.delete('OPTIMIZE TABLE organizations;'); // fix breaking of indexes due to deletes (mysql bug?)
    await Database.end();
};
