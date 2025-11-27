import { test as base } from "@playwright/test";
import { DashboardPage } from "./helpers/DashboardPage";
import { PlaywrightTestUtilsHelper } from "./helpers/PlaywrightTestUtilsHelper";
import { WorkerHelper } from "./helpers/WorkerHelper";
WorkerHelper.loadDatabaseEnvironment();

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
            const { teardown } = await WorkerHelper.startServices(workerInfo);

            await PlaywrightTestUtilsHelper.executeBeforeAll();
            // run all tests for worker
            console.log('Running tests for worker ', workerInfo.workerIndex);
            await use();
            await PlaywrightTestUtilsHelper.executeAfterAll();

            await teardown();
            console.log('Finished teardown for worker  ', workerInfo.workerIndex);
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
            await PlaywrightTestUtilsHelper.executeBeforeEach();
            // run test
            await use();
            await PlaywrightTestUtilsHelper.executeAfterEach();
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
