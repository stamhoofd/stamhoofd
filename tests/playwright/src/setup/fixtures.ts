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
    {},
    {
        setup: void;
        urls: StamhoofdUrls;
    }
>({
    // setup worker
    setup: [
        async ({}, use, workerInfo) => {
            const { teardown } = await WorkerHelper.startServices(workerInfo);

            // run all tests for worker
            await use();

            await teardown();
        },
        {
            scope: "worker",
            timeout: 120000,
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

// console.log('set test')
// // the extended test has to be set to the test utils helper (because the hooks have to be called on this test instance)
PlaywrightTestUtilsHelper.setTest(test);
