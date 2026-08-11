import { Column, Database } from '@simonbackx/simple-database';
import { endStatisticsConnection } from '@stamhoofd/statistics-db/connection';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

Error.stackTraceLimit = 100;

// Set version of saved structures
Column.setJSONVersion(Version);

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

afterAll(async () => {
    await endStatisticsConnection();
    await Database.end();
});

TestUtils.setup();
