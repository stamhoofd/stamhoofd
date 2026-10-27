// first import nock
import nock from 'nock';

// prevent nock import from being removed on save
console.log('Imported nock: ', !!nock);

import { TestUtils } from '@stamhoofd/test-utils';
import type { TestProject } from 'vitest/node';
import type { ApiLocales } from './test-locales.js';

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export async function setup(project: TestProject) {
    TestUtils.globalSetup();

    const { Database } = await import('@node/database');

    const { run } = await import('../src/migrate.js');
    await run();

    const { I18n } = await import('@stamhoofd/backend-i18n');
    const locales: ApiLocales = [...I18n.loadedLocales].map(([locale, messages]) => [locale, [...messages]]);
    project.provide('apiLocales', locales);

    await Database.end();
};
