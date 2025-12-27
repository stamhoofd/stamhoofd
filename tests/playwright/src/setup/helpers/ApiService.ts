import { CaddyConfigHelper } from "./CaddyConfigHelper";
import { DatabaseHelper } from "./DatabaseHelper";
import { NetworkHelper } from "./NetworkHelper";
import { ServiceHelper, ServiceProcess } from "./ServiceHelper";
export class ApiService implements ServiceHelper {
    constructor(private workerId: string) {}

    async start(): Promise<ServiceProcess> {
        const domain = CaddyConfigHelper.getDomain("api", this.workerId);

        // Reload database so we have the right one
        const { Database } = await import("@simonbackx/simple-database");
        await Database.reload();

        // Start api
        const { run: runMigrations } =
            await require("@stamhoofd/backend/src/migrate");
        await runMigrations();

        // Clear database before we start
        const databaseHelper = new DatabaseHelper(this.workerId);

        await databaseHelper.clear();

        console.log(`Database cleared for worker ${this.workerId}.`);

        const { boot } = await require("@stamhoofd/backend/src/boot");
        const { shutdown } = await boot({ killProcess: false });

        return {
            wait: async () => {
                console.log("Waiting for backend server...");
                await NetworkHelper.waitForUrl(
                    "https://" + domain + "/organizations/search",
                );
                console.log("Backend server ready");
            },
            kill: async () => {
                await shutdown();
            },
        };
    }
}
