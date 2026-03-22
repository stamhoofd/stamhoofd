// first import nock
import nock from 'nock';

// prevent nock import from being removed on save
console.log('Imported nock: ', !!nock);

import { TestUtils } from '@stamhoofd/test-utils';

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export async function setup() {
    TestUtils.globalSetup();

    const { Database } = await import('@simonbackx/simple-database');

    const { run } = await import('../src/migrate.js');
    await run();

    await Database.end();
};
