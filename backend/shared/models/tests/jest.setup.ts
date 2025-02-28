import backendEnv from '@stamhoofd/backend-env';
backendEnv.load({ path: __dirname + '/../../.env.test.json' });

import { Column, Database } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

// Set version of saved structures
Column.setJSONVersion(Version);

// Automatically set endpoint default version to latest one (only in tests!)
Request.defaultVersion = Version;

console.log = jest.fn();
afterAll(async () => {
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
    await Database.end();
});

TestUtils.setup();
EmailMocker.infect();
