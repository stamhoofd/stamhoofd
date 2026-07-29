import nock from 'nock';
import { TestUtils } from '@stamhoofd/test-utils';

console.log('Imported nock: ', !!nock);

process.env.TZ = 'UTC';
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export async function setup() {
    TestUtils.globalSetup();
}
