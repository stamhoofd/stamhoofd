
// Setup environment + register beforeAll/before/... hooks with Playwright
import { TestUtils } from "@stamhoofd/test-utils";
import { PlaywrightHooks } from "./helpers/PlaywrightHooks";
TestUtils.globalSetup(new PlaywrightHooks());
TestUtils.setup();

// All other imports perferably later
import { test as base } from "@playwright/test";
import { DashboardPage } from "./helpers/DashboardPage";
import { WorkerHelper } from "./helpers/WorkerHelper";

export const test = base.extend<
    {
        forEach: void;
        dashboard: DashboardPage;
    },
    {
        setup: void;
    }
>({
    // setup worker
    setup: [
        async ({}, use, workerInfo) => {
            // Override environment with specific environment for this worker
            await WorkerHelper.loadEnvironment();

            // Start services
            console.log('Starting services for worker', workerInfo.workerIndex)
            const { teardown } = await WorkerHelper.startServices(workerInfo);

            // run all tests for worker
            console.log('Running tests for worker ', workerInfo.workerIndex);
            await use();

            console.log('Tearing down worker', workerInfo.workerIndex)
            await teardown();
            console.log('Finished teardown for worker ', workerInfo.workerIndex);
        },
        {
            scope: "worker",
            timeout: 120000,
            auto: true,
        },
    ],
    // run beforeEach and afterEach of TestUtils automatically for each test
    forEach: [
        async ({}, use) => {
            //await PlaywrightTestUtilsHelper.executeBeforeEach();
            // run test
            await use();
            //await PlaywrightTestUtilsHelper.executeAfterEach();
        },
        {
            scope: "test",
            auto: true,
        },
    ],
    // create dashboard page
    dashboard: [
        async ({ page }, use) => {
            await use(new DashboardPage(page));
        },
        {
            scope: "test",
        },
    ],
});
