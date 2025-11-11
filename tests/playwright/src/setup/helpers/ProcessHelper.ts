import { spawn, SpawnOptions } from "child_process";

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
}
