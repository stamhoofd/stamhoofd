import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import { once } from 'events';

export class STChildProcess {
    command: string;
    args: readonly string[] = [];
    options: SpawnOptions = {};

    process: ChildProcess;

    constructor(
        command: string,
        args: readonly string[] = [],
        options: SpawnOptions = {},
    ) {
        this.command = command;
        this.args = args;
        this.options = options;

        const childProcess = spawn(command, args, options);
        this.process = childProcess;

        // Stop the server when this process exits (e.g. Ctrl+C or test end)
        const cleanup = () => {
            if (!childProcess.killed) {
                console.log('Stopping child process... (' + this.command + ')');
                childProcess.kill('SIGTERM');
            }
        };

        // Also kill the child process when stopping the parent process
        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
    }

    enableLog() {
        // 1) Log anything written to stderr/stdout
        this.onData((data: Uint8Array) => {
            console.log(data.toString());
        });

        // 2) Log spawn errors (command not found, permissions, etc.)
        this.process.on('error', (err) => {
            console.error(err);
        });
    }

    async then(onFulfilled: (value: { code: number }) => any, onRejected: (reason: any) => any): Promise<any> {
        const call = async () => {
            const [code] = await once(this.process, 'close');
            if (code !== 0) throw new Error(`Exit code ${code}`);
            return { code };
        };

        return call().then(onFulfilled, onRejected);
    }

    onData(handler: (data: any) => void) {
        this.process.stderr?.on('data', handler);
        this.process.stdout?.on('data', handler);
    }

    offData(handler: (data: any) => void) {
        this.process.stderr?.off('data', handler);
        this.process.stdout?.off('data', handler);
    }
}
