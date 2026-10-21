import nock from 'nock';
import { Column } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { I18n } from '@stamhoofd/backend-i18n';
import { QueueHandler } from '@stamhoofd/queues';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

nock.disableNetConnect();
process.env.TZ = 'UTC';
Column.setJSONVersion(Version);
Request.defaultVersion = Version;
TestUtils.setup();
console.log = () => {};

beforeAll(async () => {
    await I18n.load();
    // These tests have no request context, but still use real translations.
    const getI18n = () => I18n.override ?? new I18n(I18n.defaultLanguage, STAMHOOFD.fixedCountry ?? I18n.defaultCountry);
    global.$t = (key, replace) => getI18n().$t(key, replace);
    global.$getLanguage = () => getI18n().language;
    global.$getCountry = () => getI18n().country;
});

afterEach(async () => {
    await QueueHandler.awaitAll();
});
