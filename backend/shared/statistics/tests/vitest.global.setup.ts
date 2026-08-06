import { TestUtils } from '@stamhoofd/test-utils';

export async function setup() {
    TestUtils.globalSetup();

    const { Database } = await import('@simonbackx/simple-database');
    const { runStatisticsMigrations } = await import('../src/migrations.js');

    await runStatisticsMigrations();
    await Database.end();
};
