import { TestUtils } from '@stamhoofd/test-utils';

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export function setup() {
    TestUtils.globalSetup();
}
