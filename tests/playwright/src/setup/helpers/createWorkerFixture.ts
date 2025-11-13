import { test as base, Browser } from "@playwright/test";
import { setupWorker, WorkerContext } from "../helpers/setupWorker";

export function createWorkerFixture<T extends {}>(
    callback: (
        args: { browser: Browser },
        workerContext: WorkerContext,
    ) => Promise<T>,
) {
    return base.extend<
        {},
        {
            workerContext: WorkerContext & T;
        }
    >({
        workerContext: [
            async ({ browser }, use) => {
                const { workerContext, teardown } = await setupWorker();
                const result = await callback({ browser }, workerContext);
                await use({ ...workerContext, ...result });
                await teardown();
            },
            {
                scope: "worker",
                timeout: 120000,
            },
        ],
    });
}
