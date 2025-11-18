import { test as base } from "@playwright/test";
import type Models from "@stamhoofd/models";
import { createRequire } from "node:module";
import { getUrl } from "../helpers/getUrl";
import { setupWorker } from "../helpers/setupWorker";
import { TestInstance } from "../helpers/TestUtils";
const require = createRequire(import.meta.url);

export type Urls = {
    api: string;
    dashboard: string;
    webshop: string;
    registration: string;
};

export const test = base.extend<
    { TestUtils: TestInstance; Models: typeof Models },
    {
        setup: { TestUtils: TestInstance };
        urls: Urls;
    }
>({
    setup: [
        async ({}, use, workerInfo) => {
            const { teardown } = await setupWorker(workerInfo);

            const TestUtils = new TestInstance(STAMHOOFD);

            await TestUtils.beforeAll();

            await use({ TestUtils });

            await TestUtils.afterAll();

            await teardown();
        },
        {
            scope: "worker",
            timeout: 120000,
            auto: true,
        },
    ],
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
    Models: async ({}, use) => {
        const models = require("@stamhoofd/models") as typeof Models;
        await use(models);
    },
});
