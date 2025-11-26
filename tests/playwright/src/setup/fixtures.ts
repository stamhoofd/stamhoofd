import { test as base } from "@playwright/test";
import { PlaywrightCaddyConfigHelper } from "./helpers/PlaywrightCaddyConfigHelper";
import { PlaywrightTestUtilsHelper } from "./helpers/PlaywrightTestUtilsHelper";
import { WorkerHelper } from "./helpers/WorkerHelper";
WorkerHelper.loadDatabaseEnvironment();


export type StamhoofdUrls = {
    readonly api: string;
    readonly dashboard: string;
    readonly webshop: string;
    readonly registration: string;
};

export const test = base.extend<
    {
        forEach: void;
    },
    {
        setup: void;
        urls: StamhoofdUrls;
    }
>({
    // setup worker
    setup: [
        async ({}, use, workerInfo) => {
            const { teardown } = await WorkerHelper.startServices(workerInfo);

            await PlaywrightTestUtilsHelper.executeBeforeAll();
            // run all tests for worker
            await use();
            await PlaywrightTestUtilsHelper.executeAfterAll();

            await teardown();
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
    // todo: move to WorkerHelper?
    // urls to use in tests (dependent on worker id)
    urls: [
        async ({}, use, workerInfo) => {
            const workerId = workerInfo.workerIndex.toString();

            await use({
                api: PlaywrightCaddyConfigHelper.getUrl("api", workerId),
                dashboard: PlaywrightCaddyConfigHelper.getUrl(
                    "dashboard",
                    workerId,
                ),
                webshop: PlaywrightCaddyConfigHelper.getUrl(
                    "webshop",
                    workerId,
                ),
                registration: PlaywrightCaddyConfigHelper.getUrl(
                    "registration",
                    workerId,
                ),
            });
        },
        {
            scope: "worker",
        },
    ],
});
