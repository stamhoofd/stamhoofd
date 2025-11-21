import { WorkerInfo } from "@playwright/test";
import builder from "@stamhoofd/build-development-env";
import { ApiService } from "./ApiService";
import { CaddyHelper } from "./CaddyHelper";
import { DatabaseHelper } from "./DatabaseHelper";
import { FrontendProjectName, FrontendService } from "./FrontendService";

export async function setupWorker(workerInfo: WorkerInfo) {
    const workerId = workerInfo.workerIndex.toString();
    const caddyHelper = new CaddyHelper();

    // start api
    const apiService = new ApiService(workerId);
    const apiProcess = await apiService.start();

    // start frontend services
    const frontendServiceNames: FrontendProjectName[] = [
        "dashboard",
        "registration",
        "webshop",
    ];
    const frontendServices = frontendServiceNames.map(
        (name) => new FrontendService(name, workerId),
    );

    const frontendProcesses = await Promise.all(
        frontendServices.map((service) => service.start()),
    );

    // configure caddy
    const allProcesses = [...frontendProcesses, apiProcess];
    await caddyHelper.configure(
        allProcesses.flatMap((s) => s.caddyConfig?.routes ?? []),
        allProcesses.flatMap((s) => s.caddyConfig?.domains ?? []),
    );

    // wait until api is ready
    await apiProcess.wait();

    // clear database
    const databaseHelper = new DatabaseHelper(workerId);
    await databaseHelper.clear();

    // expose frontend environment (should happen after api is ready)
    await exposeFrontendEnvironment();

    await Promise.all(frontendProcesses.map((p) => p.wait()));

    return {
        teardown: async () => {
            // kill processes
            await Promise.all(allProcesses.map((p) => p.kill?.()));
        },
    };
}

async function exposeFrontendEnvironment() {
    // todo: maybe should have different environment depending on frontend server?
    const env: FrontendEnvironment = await builder.build(
        process.env.STAMHOOFD_ENV ?? "",
        {
            frontend: "dashboard",
        },
    );

    STAMHOOFD.EXPOSE_FRONTEND_ENVIRONMENT = env;
}
