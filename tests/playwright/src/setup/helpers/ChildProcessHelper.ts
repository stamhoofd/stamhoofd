import { ChildProcess, spawn, SpawnOptions } from "child_process";
import { once } from "events";

export class ChildProcessHelper {
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

    static logErrors(child: ChildProcess) {
        // 1) Log anything written to stderr
        child.stderr?.on("data", (data: Uint8Array) => {
            console.error("Process stderr:", data.toString());
        });

        // 2) Log spawn errors (command not found, permissions, etc.)
        child.on("error", (err) => {
            console.error("Failed to start process:", err);
        });
    }

    static async await(child: ChildProcess) {
        const [code] = await once(child, "close");

        if (code !== 0) throw new Error(`Exit code ${code}`);
    }
}
