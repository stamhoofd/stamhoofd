import { Column } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

Error.stackTraceLimit = 100;
Column.setJSONVersion(Version);
Request.defaultVersion = Version;
process.env.TZ = 'UTC';

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

console.log = () => {};

beforeAll(async () => {
    TestUtils.loadEnvironment();
});

TestUtils.setup();
