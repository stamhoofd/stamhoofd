// first import nock
import nock from 'nock';

// prevent nock import from being removed on save
console.log('Imported nock: ', !!nock);

import { TestUtils } from '@stamhoofd/test-utils';
import path from 'path';
const emailPath = require.resolve('@stamhoofd/email');
const modelsPath = require.resolve('@stamhoofd/models');

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export default async () => {
    await TestUtils.globalSetup();

    const { Database, Migration } = await import('@simonbackx/simple-database');

    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + '/migrations');
    await Migration.runAll(path.dirname(emailPath) + '/migrations');

    // Internal
    await Migration.runAll(__dirname + '/src/migrations');

    await Database.end();
};
