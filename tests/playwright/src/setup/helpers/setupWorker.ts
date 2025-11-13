import { WorkerInfo } from "@playwright/test";
import { ApiServerHelper } from "./ApiServerHelper";
import { CaddyHelper } from "./CaddyHelper";
import { DatabaseHelper } from "./DatabaseHelper";
import { FrontendServerHelper } from "./FrontendServerHelper";
import { getUrl } from "./getUrl";

export type WorkerContext = {
    workerIndex: number;
    urls: {
        api: string;
        dashboard: string;
        webshop: string;
        registration: string;
    };
};

export async function setupWorker(workerInfo: WorkerInfo) {
    const caddyHelper = new CaddyHelper();

    const apiServerHelper = new ApiServerHelper();
    const frontendServerHelper = new FrontendServerHelper();

    const workerIndex = workerInfo.workerIndex;
    const workerId = workerIndex.toString();

    // start api
    const apiProcesses = await apiServerHelper.start(workerId);

    // start frontend services
    const frontendProcesses = await frontendServerHelper.start(workerId);

    // configure caddy
    await caddyHelper.configure(
        [...apiProcesses.caddyRoutes, ...frontendProcesses.caddyRoutes],
        [
            ...apiProcesses.domains,
            ...apiProcesses.domains.map((domain) => "*." + domain),
            ...frontendProcesses.domains,
        ],
    );

    // wait until all services are reachable
    await apiProcesses.wait();

    // clear database
    const databaseHelper = new DatabaseHelper();
    await databaseHelper.clear(workerId);

    await frontendProcesses.wait();

    const workerContext: WorkerContext = {
        workerIndex,
        urls: {
            api: getUrl("api", workerId),
            dashboard: getUrl("dashboard", workerId),
            webshop: getUrl("webshop", workerId),
            registration: getUrl("registration", workerId),
        },
    };

    return {
        workerContext,
        teardown: async () => {
            // kill processes
            await apiProcesses.kill();
            await frontendProcesses.kill();

            // cleanup caddy config
            // await caddyCleanup();
        },
    };
}
