import { WorkerInfo } from "@playwright/test";
import builder from "@stamhoofd/build-development-env";
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

    // wait until api is ready
    await apiProcesses.wait();

    // clear database
    const databaseHelper = new DatabaseHelper();
    await databaseHelper.clear(workerId);

    // expose frontend environment (should happen after api is ready)
    await exposeFrontendEnvironment();
    
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
        },
    };
}

async function exposeFrontendEnvironment() {
    const name: "dashboard" | "registration" | "webshop" | "calculator" =
        "dashboard";

    const env: FrontendEnvironment = await builder.build(
        process.env.STAMHOOFD_ENV ?? "",
        {
            frontend: name,
        },
    );

    (STAMHOOFD as any).EXPOSE_FRONTEND_ENVIRONMENT = env;
}
