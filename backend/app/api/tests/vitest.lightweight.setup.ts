import nock from 'nock';
import { Column } from '@simonbackx/simple-database';
import { Request } from '@node/endpoints';
import { I18n } from '@stamhoofd/backend-i18n';
import { QueueHandler } from '@stamhoofd/queues';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { loadTestLocales } from './test-locales.js';

nock.disableNetConnect();
process.env.TZ = 'UTC';
Column.setJSONVersion(Version);
Request.defaultVersion = Version;
TestUtils.setup();
console.log = () => {};

beforeAll(() => {
    loadTestLocales();
    // These tests have no request context, but still use real translations.
    const getI18n = () => I18n.override ?? new I18n(I18n.defaultLanguage, STAMHOOFD.fixedCountry ?? I18n.defaultCountry);
    (global as any).$t = (key: string, replace?: Record<string, string>) => getI18n().$t(key, replace);
    (global as any).$getLanguage = () => getI18n().language;
    (global as any).$getCountry = () => getI18n().country;
});

afterEach(async () => {
    await QueueHandler.awaitAll();
});
