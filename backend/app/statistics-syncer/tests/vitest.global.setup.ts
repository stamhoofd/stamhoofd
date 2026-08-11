import { TestUtils } from '@stamhoofd/test-utils';
import path from 'path';

// Dates are stored and compared in UTC everywhere else in the repo; a date column read back in
// another zone lands a day off.
process.env.TZ = 'UTC';

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

const modelsPath = require.resolve('@stamhoofd/models');

export async function setup() {
    TestUtils.globalSetup();

    const { Database, Migration } = await import('@simonbackx/simple-database');
    const { runStatisticsMigrations } = await import('@stamhoofd/statistics-db/migrations');

    // The sync reads the source tables, so the main database has to be migrated as well.
    if (!await Migration.runAll(path.dirname(modelsPath) + '/migrations')) {
        throw new Error('Migrations failed');
    }

    await runStatisticsMigrations();
    await Database.end();
};
