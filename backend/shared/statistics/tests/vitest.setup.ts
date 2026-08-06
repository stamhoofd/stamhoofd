import { Column, Database } from '@simonbackx/simple-database';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { endStatisticsConnection } from '../src/connection.js';

// Set version of saved structures
Column.setJSONVersion(Version);

afterAll(async () => {
    await endStatisticsConnection();
    await Database.end();
});

TestUtils.setup();
