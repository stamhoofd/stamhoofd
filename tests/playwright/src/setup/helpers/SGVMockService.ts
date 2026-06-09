import { resolve } from "node:path";
import { CaddyConfigHelper } from "./CaddyConfigHelper.js";
import { NetworkHelper } from "./NetworkHelper.js";
import type { ServiceHelper, ServiceProcess } from "./ServiceHelper.js";
import { STChildProcess } from "./STChildProcess.js";

/** Starts one SGV mock process per Playwright worker on its allocated port. */
export class SGVMockService implements ServiceHelper {
    constructor(private workerId: string) {}

    async start(): Promise<ServiceProcess> {
        const port = CaddyConfigHelper.getPort("sgv-mock", this.workerId);
        const childProcess = new STChildProcess(
            "node",
            [
                "--enable-source-maps",
                resolve(
                    import.meta.dirname,
                    "../../../../../../backend/app/sgv-mock/dist/index.js",
                ),
            ],
            {
                env: {
                    ...process.env,
                    NODE_ENV: "test",
                    PORT: port.toString(),
                },
            },
        );
        childProcess.enableLog();

        return {
            name: "sgv-mock",
            wait: async () => {
                await NetworkHelper.waitForUrl(`http://127.0.0.1:${port}/`);
            },
            kill: async () => {
                childProcess.process.kill("SIGTERM");
            },
        };
    }
}
