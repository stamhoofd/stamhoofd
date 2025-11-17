import { test as base } from "@playwright/test";
import { type TestUtils as TestInstance } from "@stamhoofd/test-utils";
import { createRequire } from "node:module";
import { setupWorker, WorkerContext } from "../helpers/setupWorker";

const require = createRequire(import.meta.url);
const { TestUtils } = require("@stamhoofd/test-utils") as {
    TestUtils: typeof TestInstance;
};

export const test = base.extend<
    { TestUtils: typeof TestInstance },
    {
        workerContext: WorkerContext;
    }
>({
    workerContext: [
        async ({}, use, workerInfo) => {
            const { workerContext, teardown } = await setupWorker(workerInfo);

            TestUtils.setup();
            await TestUtils.loadEnvironment();
            await TestUtils.beforeAll();

            await use(workerContext);

            await TestUtils.afterAll();

            await teardown();
        },
        {
            scope: "worker",
            timeout: 120000,
            auto: true,
        },
    ],
    TestUtils: [
        async ({}, use) => {
            await TestUtils.beforeEach();

            await use(TestUtils);

            await TestUtils.afterEach();
        },
        {
            auto: true,
        },
    ],
});
