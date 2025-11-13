import { ApiServerHelper } from "./ApiServerHelper";
import { CaddyHelper } from "./CaddyHelper";
import { DatabaseHelper } from "./DatabaseHelper";
import { FrontendServerHelper } from "./FrontendServerHelper";
import { getUrl } from "./getUrl";

export type WorkerContext = {
    workerIndex: string;
    urls: {
        api: string;
        dashboard: string;
        webshop: string;
        registration: string;
    };
};

export async function setupWorker() {
    const caddyHelper = new CaddyHelper();

    const apiServerHelper = new ApiServerHelper();
    const frontendServerHelper = new FrontendServerHelper();

    const workerIndex = process.env.TEST_WORKER_INDEX!;

    // start api
    const apiProcesses = await apiServerHelper.start(workerIndex);

    // start frontend services
    const frontendProcesses = await frontendServerHelper.start(workerIndex);

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
    await databaseHelper.clear(workerIndex);

    await frontendProcesses.wait();

    const workerContext: WorkerContext = {
        workerIndex,
        urls: {
            api: getUrl("api", workerIndex),
            dashboard: getUrl("dashboard", workerIndex),
            webshop: getUrl("webshop", workerIndex),
            registration: getUrl("registration", workerIndex),
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
