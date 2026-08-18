import { Database } from '@simonbackx/simple-database';
import { TestUtils } from '@stamhoofd/test-utils';
import nock from 'nock';

process.env.TZ = 'UTC';
nock.disableNetConnect();
TestUtils.setup();

afterEach(async () => {
    nock.cleanAll();
    await Database.delete('DELETE FROM `vies_cached_results`');
});

afterAll(async () => {
    await Database.end();
});
