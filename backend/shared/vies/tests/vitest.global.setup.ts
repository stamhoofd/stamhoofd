import { TestUtils } from '@stamhoofd/test-utils';
import path from 'node:path';

const modelsPath = require.resolve('@stamhoofd/models');

export async function setup() {
    TestUtils.globalSetup();

    const { Database, Migration } = await import('@simonbackx/simple-database');
    if (!await Migration.runAll(path.dirname(modelsPath) + '/migrations')) {
        throw new Error('Migrations failed');
    }

    await Database.delete('DELETE FROM `vies_cached_results`');
    await Database.end();
}
