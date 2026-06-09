import { resolve } from "node:path";
import { STChildProcess } from "./STChildProcess.js";

/** Builds the SGV mock backend once during Playwright setup so workers can start the compiled service quickly. */
export class SGVMockBuilder {
    async build() {
        console.log("Start building SGV mock...");

        const childProcess = new STChildProcess("yarn", ["-s", "build"], {
            cwd: resolve(
                import.meta.dirname,
                "../../../../../../backend/app/sgv-mock",
            ),
            env: {
                ...process.env,
                NODE_ENV: "test",
                STAMHOOFD_ENV: "playwright",
            },
        });
        childProcess.enableLog();

        await childProcess;
        console.log("Done building SGV mock.");
    }
}
