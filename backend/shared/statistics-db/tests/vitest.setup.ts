import { Database } from '@simonbackx/simple-database';
import { TestUtils } from '@stamhoofd/test-utils';
import { endStatisticsConnection } from '../src/connection.js';

process.env.TZ = 'UTC';

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

afterAll(async () => {
    await endStatisticsConnection();
    await Database.end();
});

TestUtils.setup();
