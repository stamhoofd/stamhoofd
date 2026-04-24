// first import nock

import { Column } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

Error.stackTraceLimit = 100;

// Set version of saved structures
Column.setJSONVersion(Version);

// Automatically set endpoint default version to latest one (only in tests!)
Request.defaultVersion = Version;

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

console.log = () => {};

beforeAll(async () => {
    // Override default $t handlers
    TestUtils.loadEnvironment();
});
TestUtils.setPermanentEnvironment('CACHE_PATH', import.meta.dirname + '/../.test-cache')
TestUtils.setup();
