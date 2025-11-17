import { ChildProcess, spawn, SpawnOptions } from "child_process";
import { once } from "events";

export class ProcessHelper {
    static spawnWithCleanup(
        command: string,
        args: readonly string[] = [],
        options: SpawnOptions = {},
    ) {
        const childProcess = spawn(command, args, options);

        // Stop the server when this process exits (e.g. Ctrl+C or test end)
        const cleanup = () => {
            if (!childProcess.killed) {
                console.log("Stopping child process...");
                childProcess.kill("SIGTERM");
            }
        };

        process.on("exit", cleanup);
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);

        return childProcess;
    }

    static async awaitChild(childProcess: ChildProcess) {
        const [code] = await once(childProcess, "close");

        if (code !== 0) throw new Error(`Exit code ${code}`);
    }
}
