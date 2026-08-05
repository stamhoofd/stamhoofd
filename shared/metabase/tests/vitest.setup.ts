import { TestUtils } from '@stamhoofd/test-utils';

process.env.TZ = 'UTC';

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

TestUtils.setup();
