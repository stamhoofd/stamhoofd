import { TestUtils } from '@stamhoofd/test-utils';
import path from 'path';

const modelsPath = require.resolve('@stamhoofd/models');

export async function setup() {
    TestUtils.globalSetup();

    const { Database, Migration } = await import('@simonbackx/simple-database');
    const { runStatisticsMigrations } = await import('../src/migrations.js');

    // The sync reads the source tables, so the main database has to be migrated as well.
    if (!await Migration.runAll(path.dirname(modelsPath) + '/migrations')) {
        throw new Error('Migrations failed');
    }

    await runStatisticsMigrations();
    await Database.end();
};
