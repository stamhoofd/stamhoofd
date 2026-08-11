import { TestUtils } from '@stamhoofd/test-utils';

// Dates are stored and compared in UTC everywhere else in the repo; a date column read back in
// another zone lands a day off.
process.env.TZ = 'UTC';

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export async function setup() {
    TestUtils.globalSetup();

    // The report queries run against the real schema, so it has to exist before they do.
    const { Database } = await import('@simonbackx/simple-database');
    const { runStatisticsMigrations } = await import('@stamhoofd/statistics-db/migrations');

    await runStatisticsMigrations();
    await Database.end();
};
