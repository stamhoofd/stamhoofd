import { test as base } from "@playwright/test";
import type Models from "@stamhoofd/models";
import { createRequire } from "node:module";
import { getUrl } from "./helpers/getUrl";
import { setupWorker } from "./helpers/setupWorker";
import { TestUtils } from "./helpers/TestUtils";
const require = createRequire(import.meta.url);

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
        Models: typeof Models;
    }
>({
    // setup worker
    setup: [
        async ({}, use, workerInfo) => {
            const { teardown } = await setupWorker(workerInfo);

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
                api: getUrl("api", workerId),
                dashboard: getUrl("dashboard", workerId),
                webshop: getUrl("webshop", workerId),
                registration: getUrl("registration", workerId),
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
    // import Models module (is dependent on worker environment)
    Models: [
        async ({}, use) => {
            const models = require("@stamhoofd/models") as typeof Models;
            await use(models);
        },
        {
            scope: "worker",
        },
    ],
});
