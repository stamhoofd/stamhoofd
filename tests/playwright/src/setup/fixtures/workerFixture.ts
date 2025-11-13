import { test as base } from "@playwright/test";
import { setupWorker, WorkerContext } from "../helpers/setupWorker";

const worker = base.extend<
    {},
    {
        workerContext: WorkerContext;
    }
>({
    workerContext: [
        async ({}, use, workerInfo) => {
            const { workerContext, teardown } = await setupWorker(workerInfo);
            await use(workerContext);
            await teardown();
        },
        {
            scope: "worker",
            timeout: 120000,
        },
    ],
});
