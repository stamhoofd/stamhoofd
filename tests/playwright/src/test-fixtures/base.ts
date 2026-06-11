// Setup environment + register beforeAll/before/... hooks with Playwright
import { test as base, expect } from '@playwright/test';
import { TestUtils } from '@stamhoofd/test-utils';
import { PlaywrightHooks } from '../setup/helpers/PlaywrightHooks.js';

global.expect = expect;

// Load database
TestUtils.loadEnvironment();

// All other imports perferably later
import { Logger, Pages, WorkerData } from '../helpers/index.js';
import { initMembershipOrganization } from '../init/initMembershipOrganization.js';
import { WorkerHelper } from '../setup/helpers/WorkerHelper.js';

/**
 * Playwright fixtures don't give us everything we need. We need to have a reliable beforeAll - the fixtures run after the beforeAll inside the test files lol.
 * It is too limited sadly (and so custom to one framework...).
 *
 * That is why we work with a setup method. This creates the beforeAll and beforeEaches directly in each test file for reliability.
 *
 * We cannot run beforeAll in the root because that would create a side effect that won't be rerun in every test file.
 */
export function setup() {
    TestUtils.globalSetup(new PlaywrightHooks());

    // eslint-disable-next-line no-empty-pattern
    base.beforeAll(async ({}, testInfo) => {
        Logger.info('BEFORE ALL' + testInfo.file);

        // Note: we use a custom beforeall here for the simple reason that Playwright fixtures are called after the beforeAll inside the tests,
        // which is too late to reset environments
        if (testInfo.file !== WorkerData.lastFile) {
            Logger.info('Worker moved to a new file: ' + testInfo.file);
            WorkerData.lastFile = testInfo.file;

            // Resetting database
            await WorkerData.resetDatabase();

            // Reset environment (remove any set environments from different files)
            WorkerHelper.loadEnvironment({ force: true });
        }
    });

    // eslint-disable-next-line no-empty-pattern
    base.beforeEach(({}, testInfo) => {
        Logger.info('BEFORE EACH' + testInfo.file);
    });

    TestUtils.setup();
}

/**
 * Base test fixture (unauthenticated)
 */
export const test = base.extend<
    {
        forEach: void;
        pages: Pages;
    },
    {
        setup: void;
    }
>({
    // setup worker
    setup: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use, workerInfo) => {
            // Resetting database
            await WorkerData.resetDatabase();

            // Override environment with specific environment for this worker
            WorkerHelper.loadEnvironment({ force: true });

            // Start services
            console.log('Starting services for worker', workerInfo.parallelIndex);
            const { teardown } = await WorkerHelper.startServices(workerInfo);

            // run all tests for worker
            console.log('Running tests for worker ', workerInfo.parallelIndex);

            // Make sure we have a membership organization set
            await initMembershipOrganization();

            await use();

            console.log('Tearing down worker', workerInfo.parallelIndex);
            await teardown();
            console.log(
                'Finished teardown for worker ',
                workerInfo.parallelIndex,
            );
        },
        {
            scope: 'worker',
            timeout: 120000,
            auto: true,
        },
    ],
    // run beforeEach and afterEach of TestUtils automatically for each test
    forEach: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use, testInfo) => {
            Logger.info('Running test: ' + testInfo.titlePath.join(' > '));
            // run test
            await use();
            Logger.info('Finished test: ' + testInfo.titlePath.join(' > '));
        },
        {
            scope: 'test',
            auto: true,
        },
    ],
    // create dashboard page
    pages: [
        async ({ page }, use) => {
            await use(new Pages(page));
        },
        {
            scope: 'test',
        },
    ],
});
