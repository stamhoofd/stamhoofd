import { test as base } from "@playwright/test";
import { ApiServerHelper } from "./helpers/ApiServerHelper";
import { CaddyHelper } from "./helpers/CaddyHelper";
import { FrontendServerHelper } from "./helpers/FrontendServerHelper";
import { getUrl } from "./helpers/getUrl";

export const test = base.extend<
    {},
    {
        backend: {
            workerIndex: string;
            urls: {
                api: string;
                dashboard: string;
                webshop: string;
                registration: string;
            };
        };
    }
>({
    backend: [
        async ({}, use) => {
            const caddyHelper = new CaddyHelper();

            const apiServerHelper = new ApiServerHelper();
            const frontendServerHelper = new FrontendServerHelper();

            const workerIndex = process.env.TEST_WORKER_INDEX!;

            // start api
            const apiProcesses = await apiServerHelper.start(workerIndex);

            // start frontend services
            const frontendProcesses =
                await frontendServerHelper.start(workerIndex);

            // configure caddy
            const { cleanup: caddyCleanup } = await caddyHelper.configure(
                [...apiProcesses.caddyRoutes, ...frontendProcesses.caddyRoutes],
                [...apiProcesses.domains, ...frontendProcesses.domains],
            );

            // wait until all services are reachable
            await apiProcesses.wait();
            await frontendProcesses.wait();

            // wait for tests to run
            await use({
                workerIndex,
                urls: {
                    api: getUrl("api", workerIndex),
                    dashboard: getUrl("dashboard", workerIndex),
                    webshop: getUrl("webshop", workerIndex),
                    registration: getUrl("registration", workerIndex),
                },
            });

            // kill processes
            await apiProcesses.kill();
            await frontendProcesses.kill();

            // cleanup caddy config
            await caddyCleanup();
        },
        {
            scope: "worker",
            timeout: 120000,
            // auto: true
        },
    ],
});
