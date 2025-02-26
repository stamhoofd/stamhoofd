import backendEnv from '@stamhoofd/backend-env';
backendEnv.load({ path: __dirname + '/../../.env.test.json' });

import { Database, Migration } from '@simonbackx/simple-database';
import * as jose from 'jose';
import nock from 'nock';
import path from 'path';
import { GlobalHelper } from '../src/helpers/GlobalHelper';
const emailPath = require.resolve('@stamhoofd/email');
const modelsPath = require.resolve('@stamhoofd/models');
import { TestUtils } from '@stamhoofd/test-utils';

// Disable network requests
nock.disableNetConnect();

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export default async () => {
    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + '/migrations');
    await Migration.runAll(path.dirname(emailPath) + '/migrations');

    // Internal
    await Migration.runAll(__dirname + '/src/migrations');

    await Database.end();

    await TestUtils.globalSetup();
};
