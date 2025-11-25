import { test as base } from "@playwright/test";
import { PlaywrightCaddyConfigHelper } from "./helpers/PlaywrightCaddyConfigHelper";
import { TestUtils } from "./helpers/TestUtils";
import { WorkerHelper } from "./helpers/WorkerHelper";
WorkerHelper.loadDatabaseEnvironment();

export type StamhoofdUrls = {
    readonly api: string;
    readonly dashboard: string;
    readonly webshop: string;
    readonly registration: string;
};

export const test = base.extend<
    { TestUtils: TestUtils },
    {
        setup: { readonly TestUtils: TestUtils };
        urls: StamhoofdUrls;
    }
>({
    // setup worker
    setup: [
        async ({}, use, workerInfo) => {
            const { teardown } = await WorkerHelper.startServices(workerInfo);

            // call TestUtils hooks before and after all tests
            const testUtils = new TestUtils(STAMHOOFD);

            await testUtils.beforeAll();

            // run all tests for worker
            await use({ TestUtils: testUtils });

            await testUtils.afterAll();

            await teardown();
        },
        {
            scope: "worker",
            timeout: 120000,
            auto: true,
        },
    ],
    // urls to use in tests (dependent on worker id)
    urls: [
        async ({}, use, workerInfo) => {
            const workerId = workerInfo.workerIndex.toString();

            await use({
                api: PlaywrightCaddyConfigHelper.getUrl("api", workerId),
                dashboard: PlaywrightCaddyConfigHelper.getUrl("dashboard", workerId),
                webshop: PlaywrightCaddyConfigHelper.getUrl("webshop", workerId),
                registration: PlaywrightCaddyConfigHelper.getUrl("registration", workerId),
            });
        },
        {
            scope: "worker",
        },
    ],
    // call TestUtils hooks before and after each test
    TestUtils: [
        async ({ setup: { TestUtils } }, use) => {
            TestUtils.beforeEach();

            await use(TestUtils);

            await TestUtils.afterEach();
        },
        {
            auto: true,
        },
    ],
});
