import type { ServiceStatus } from './service.js';
import type { CliContext } from '../context/create-context.js';
import * as docker from './docker.js';
import type { MaybePromise, ServiceDefinition, ServiceStartResult } from './service.js';

type PreparedValue<TPrepared> = TPrepared | undefined;

export class ContainerStoppedError extends Error {
    constructor(
        message: string,
        readonly serviceName: string,
        readonly tableDetail: string,
        readonly logs: string,
    ) {
        super(message);
        this.name = 'ContainerStoppedError';
    }
}

export async function containerStatus(name: string, serviceName: string, detail: string): Promise<ServiceStatus> {
    return {
        name: serviceName,
        running: await docker.containerIsRunning(name),
        detail,
    };
}

export async function stopContainer(name: string, verbose = false): Promise<void> {
    await docker.removeContainer(name, verbose);
}

export async function tailContainerLogs(name: string): Promise<void> {
    await docker.run(['logs', '-f', name], { allowFailure: true });
}

export abstract class DockerService<TOptions = void, TPrepared = void> implements ServiceDefinition<TOptions> {
    abstract key: string;
    abstract name: string;

    readonly logsEnabled: boolean = true;
    readonly runQuiet: boolean = true;

    abstract getContainer(context: CliContext): string;
    abstract getDockerArgs(context: CliContext, options: TOptions, prepared: PreparedValue<TPrepared>): MaybePromise<string[]>;

    getDetail(_context: CliContext): MaybePromise<string> {
        return '';
    }

    getLogin(_context: CliContext): MaybePromise<string | undefined> {
        return undefined;
    }

    prepare(_context: CliContext, _options: TOptions, _status: ServiceStatus): MaybePromise<PreparedValue<TPrepared>> {
        return undefined;
    }

    canReuse(_context: CliContext, _options: TOptions, _prepared: PreparedValue<TPrepared>, status: ServiceStatus): MaybePromise<boolean> {
        return status.running;
    }

    beforeRun(_context: CliContext, _options: TOptions, _prepared: PreparedValue<TPrepared>): MaybePromise<void> {
    }

    afterRun(_context: CliContext, _options: TOptions, _prepared: PreparedValue<TPrepared>): MaybePromise<void> {
    }

    getEnv(_context: CliContext, _options: TOptions, _prepared: PreparedValue<TPrepared>): MaybePromise<NodeJS.ProcessEnv | undefined> {
        return undefined;
    }

    alreadyRunningMessage(status: ServiceStatus): string {
        return `${status.name} already running`;
    }

    startedMessage(_context: CliContext, _options: TOptions, _prepared: PreparedValue<TPrepared>): string {
        return `${this.name} started`;
    }

    stoppedMessage(): string {
        return `Stopped ${this.name}`;
    }

    async status(context: CliContext): Promise<ServiceStatus> {
        return {
            ...await containerStatus(this.getContainer(context), this.name, await this.getDetail(context)),
            login: await this.getLogin(context),
        };
    }

    async start(context: CliContext, options: TOptions): Promise<ServiceStartResult> {
        await docker.requireDocker();
        const status = await this.status(context);
        const prepared = await this.prepare(context, options, status);

        if (await this.canReuse(context, options, prepared, status)) {
            return { message: this.alreadyRunningMessage(status) };
        }

        await stopContainer(this.getContainer(context), context.verbose);
        await this.beforeRun(context, options, prepared);
        await docker.run(await this.getDockerArgs(context, options, prepared), { quiet: this.runQuiet, verbose: context.verbose });
        const afterStart = await this.status(context);
        if (!afterStart.running) {
            const logs = await docker.getContainerLogs(this.getContainer(context));
            const lastLine = logs.split('\n').map(line => line.trim()).filter(Boolean).at(-1) ?? `${this.name} stopped immediately after start`;
            throw new ContainerStoppedError(`${this.name} stopped immediately after start`, this.name, lastLine, logs || lastLine);
        }
        await this.afterRun(context, options, prepared);

        return {
            message: this.startedMessage(context, options, prepared),
            env: await this.getEnv(context, options, prepared),
        };
    }

    async stop(context: CliContext): Promise<string> {
        await stopContainer(this.getContainer(context), context.verbose);
        return this.stoppedMessage();
    }

    async logs(context: CliContext): Promise<void> {
        if (this.logsEnabled) {
            await tailContainerLogs(this.getContainer(context));
        }
    }
}

export abstract class SharedDockerService<TPrepared = void> extends DockerService<void, TPrepared> {
}
