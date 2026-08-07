import { Column, Database } from '@simonbackx/simple-database';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { endStatisticsConnection } from '../src/connection.js';

process.env.TZ = 'UTC';

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

// Set version of saved structures
Column.setJSONVersion(Version);

afterAll(async () => {
    await endStatisticsConnection();
    await Database.end();
});

TestUtils.setup();
