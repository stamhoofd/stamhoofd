// Setup environment + register beforeAll/before/... hooks with Playwright
import { TestUtils } from '@stamhoofd/test-utils';
import { PlaywrightHooks } from '../setup/helpers/PlaywrightHooks';
// eslint-disable-next-line @typescript-eslint/no-floating-promises
TestUtils.globalSetup(new PlaywrightHooks());
TestUtils.setup();

// All other imports perferably later
import { test as base } from '@playwright/test';
import { Logger, Pages } from '../helpers';
import { WorkerHelper } from '../setup/helpers/WorkerHelper';

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
            // Override environment with specific environment for this worker
            WorkerHelper.loadEnvironment();

            // Start services
            console.log('Starting services for worker', workerInfo.workerIndex);
            const { teardown } = await WorkerHelper.startServices(workerInfo);

            // run all tests for worker
            console.log('Running tests for worker ', workerInfo.workerIndex);

            await use();

            console.log('Tearing down worker', workerInfo.workerIndex);
            await teardown();
            console.log(
                'Finished teardown for worker ',
                workerInfo.workerIndex,
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
            // await PlaywrightTestUtilsHelper.executeBeforeEach();
            // run test
            await use();
            Logger.info('Finished test: ' + testInfo.titlePath.join(' > '));
            // await PlaywrightTestUtilsHelper.executeAfterEach();
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
