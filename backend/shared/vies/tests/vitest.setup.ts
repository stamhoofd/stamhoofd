import { Database } from '@simonbackx/simple-database';
import { I18n } from '@stamhoofd/backend-i18n';
import { TestUtils } from '@stamhoofd/test-utils';
import nock from 'nock';

process.env.TZ = 'UTC';
nock.disableNetConnect();
TestUtils.setup();

beforeAll(async () => {
    await I18n.load();
    (global as any).$t = (key: string, replace?: Record<string, string>) => new I18n(I18n.defaultLanguage, I18n.defaultCountry).$t(key, replace);
});

afterEach(async () => {
    nock.cleanAll();
    await Database.delete('DELETE FROM `vies_cached_results`');
});

afterAll(async () => {
    await Database.end();
});
