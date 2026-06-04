import fs from 'node:fs/promises';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import type { CliContext } from '../context/create-context.js';
import { sharedDir } from '../runtime/manifest-store.js';
import { liveTable, spinnerCell, statusCell, step, table } from '../runtime/ux.js';
import { CliStatus } from '../runtime/status.js';
import { ContainerStoppedError } from './docker-service.js';
import type { ServiceDefinition, ServiceStartResult, ServiceStatus } from './service.js';

enum ServiceTableRowStatus {
    Starting = 'starting',
    Stopping = 'stopping',
    Running = 'running',
    Stopped = 'stopped',
    Failed = 'failed',
}

type ServiceTableRow = {
    name: string;
    status: ServiceTableRowStatus;
    detail: string;
    login?: string;
};

type ServiceTaskResult<T> = {
    row: ServiceTableRow;
    value: T;
};

type ServiceTaskContext = {
    setRow(row: ServiceTableRow): void;
};

type ServiceOptionsByKey<TOptions> = Partial<Record<string, TOptions>>;

export async function getServicesStatus<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>): Promise<ServiceStatus[]> {
    return await Promise.all(services.map(service => service.status(context)));
}

export async function allRunning<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>): Promise<boolean> {
    const statuses = await getServicesStatus(context, services);
    return statuses.every(status => status.running);
}

export async function startServices<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>, optionsByKey: ServiceOptionsByKey<TOptions> = {}): Promise<{ env: NodeJS.ProcessEnv; started: string[] }> {
    const env: NodeJS.ProcessEnv = {};
    const started: string[] = [];

    for (const service of services) {
        const before = await service.status(context);
        const result = await step(`Starting ${service.name}`, async () => await service.start(context, optionsByKey[service.key] as TOptions), { successMessage: value => (value as ServiceStartResult).message });
        if (!before.running) {
            started.push(service.key);
        }
        Object.assign(env, result.env ?? {});
    }

    return { env, started };
}

export async function startServicesInteractive<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>, optionsByKey: ServiceOptionsByKey<TOptions> = {}): Promise<{ env: NodeJS.ProcessEnv; started: string[] }> {
    const results = await runServicesInteractive(services, ServiceTableRowStatus.Starting, async (service) => {
        const before = await service.status(context);
        const result = await service.start(context, optionsByKey[service.key] as TOptions);
        const after = await service.status(context);

        return {
            row: serviceStatusToTableRow(after, result.message),
            value: { env: result.env ?? {}, started: before.running ? undefined : service.key },
        };
    });

    return {
        env: Object.assign({}, ...results.map(result => result.env)),
        started: results.map(result => result.started).filter((key): key is string => key !== undefined),
    };
}

export async function restartServicesInteractive<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>, optionsByKey: ServiceOptionsByKey<TOptions> = {}): Promise<{ env: NodeJS.ProcessEnv; started: string[] }> {
    const results = await runServicesInteractive(services, ServiceTableRowStatus.Stopping, async (service, row) => {
        await service.stop(context);
        row.setRow({ name: service.name, status: ServiceTableRowStatus.Starting, detail: ServiceTableRowStatus.Starting });
        const result = await service.start(context, optionsByKey[service.key] as TOptions);
        const after = await service.status(context);

        return {
            row: serviceStatusToTableRow(after, result.message),
            value: { env: result.env ?? {}, started: service.key },
        };
    });

    return {
        env: Object.assign({}, ...results.map(result => result.env)),
        started: results.map(result => result.started),
    };
}

export async function stopServices<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>): Promise<void> {
    for (const service of [...services].reverse()) {
        await step(`Stopping ${service.name}`, async () => await service.stop(context), { successMessage: message => message });
    }
}

export async function stopServicesInteractive<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>): Promise<void> {
    await runServicesInteractive(services, ServiceTableRowStatus.Stopping, async (service) => {
        const message = await service.stop(context);
        const after = await service.status(context);

        return {
            row: serviceStatusToTableRow(after, message),
            value: undefined,
        };
    });
}

export async function printServicesStatus<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>): Promise<void> {
    const rows = await getServicesStatus(context, services);
    table(['Service', 'Status', 'Access', 'Login'], rows.map(row => [row.name, statusCell(row.running ? CliStatus.Running : CliStatus.Stopped), row.running ? row.detail : 'Run stam services up', row.login ?? '-']), { title: 'Shared services' });
}

function formatServiceTableRow(row: ServiceTableRow, frame: number): string[] {
    if (row.status === ServiceTableRowStatus.Starting || row.status === ServiceTableRowStatus.Stopping) {
        return [row.name, spinnerCell(row.status, frame), spinnerCell(row.detail, frame), row.login ?? '-'];
    }

    return [row.name, statusCell(row.status === ServiceTableRowStatus.Running ? CliStatus.Running : row.status === ServiceTableRowStatus.Stopped ? CliStatus.Stopped : CliStatus.Failed), row.detail, row.login ?? '-'];
}

async function runServicesInteractive<T, TOptions>(services: ReadonlyArray<ServiceDefinition<TOptions>>, initialStatus: ServiceTableRow['status'], task: (service: ServiceDefinition<TOptions>, context: ServiceTaskContext) => Promise<ServiceTaskResult<T>>): Promise<T[]> {
    const rows: ServiceTableRow[] = services.map(service => ({
        name: service.name,
        status: initialStatus,
        detail: initialStatus,
        login: undefined,
    }));
    const table = liveTable(['Service', 'Status', 'Access', 'Login'], frame => formatServiceTableRows(rows, frame));

    let rejectedReason: unknown;

    try {
        const results = await Promise.allSettled(services.map(async (service, index) => {
            try {
                const result = await task(service, {
                    setRow(row) {
                        rows[index] = row;
                    },
                });
                rows[index] = result.row;
                return result.value;
            }
            catch (error) {
                rows[index] = {
                    name: service.name,
                    status: ServiceTableRowStatus.Failed,
                    detail: formatFailureDetail(error),
                };
                throw error;
            }
        }));

        const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (rejected) {
            rejectedReason = rejected.reason;
            throw rejected.reason;
        }

        return results.map((result) => {
            if (result.status === 'rejected') {
                throw result.reason;
            }

            return result.value;
        });
    }
    finally {
        table.stop();
        printServiceFailureLogs(rejectedReason);
    }
}

function formatFailureDetail(error: unknown): string {
    if (error instanceof ContainerStoppedError) {
        return error.tableDetail;
    }
    return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim();
}

function formatServiceTableRows(rows: ServiceTableRow[], frame: number): string[][] {
    const formattedRows = rows.map(row => formatServiceTableRow(row, frame));
    const accessWidth = maxAccessColumnWidth(formattedRows);

    return formattedRows.map(row => [row[0], row[1], ellipsize(row[2], accessWidth), row[3]]);
}

function maxAccessColumnWidth(rows: string[][]): number {
    const terminalWidth = process.stdout.columns ?? 120;
    const serviceWidth = maxVisibleWidth('Service', rows.map(row => row[0]));
    const statusWidth = maxVisibleWidth('Status', rows.map(row => row[1]));
    const loginWidth = maxVisibleWidth('Login', rows.map(row => row[3]));
    const borderAndPaddingWidth = 13;
    const available = terminalWidth - serviceWidth - statusWidth - loginWidth - borderAndPaddingWidth;

    return Math.max('Access'.length, Math.min(available, 100));
}

function maxVisibleWidth(header: string, cells: string[]): number {
    return Math.max(header.length, ...cells.map(visibleLength));
}

function ellipsize(value: string, maxLength: number): string {
    if (visibleLength(value) <= maxLength) {
        return value;
    }
    return `${stripVTControlCharacters(value).slice(0, maxLength - 1)}…`;
}

function visibleLength(value: string): number {
    return stripVTControlCharacters(value).length;
}

function serviceStatusToTableRow(status: ServiceStatus, fallbackDetail: string): ServiceTableRow {
    return {
        name: status.name,
        status: status.running ? ServiceTableRowStatus.Running : ServiceTableRowStatus.Stopped,
        detail: status.running ? status.detail : fallbackDetail,
        login: status.login,
    };
}

function printServiceFailureLogs(error: unknown): void {
    if (!(error instanceof ContainerStoppedError)) {
        return;
    }
    console.log(`\nLogs for ${error.serviceName}:`);
    if (error.logs) {
        console.log(error.logs);
    }
}

export async function tailServicesLogs<TOptions>(context: CliContext, services: ReadonlyArray<ServiceDefinition<TOptions>>): Promise<void> {
    for (const service of services) {
        if (service.logs) {
            await service.logs(context);
        }
    }
}

export async function writeSharedServicesManifest(context: CliContext): Promise<void> {
    await fs.mkdir(sharedDir(context), { recursive: true });
    await fs.writeFile(path.join(sharedDir(context), 'services.json'), JSON.stringify({ startedAt: new Date().toISOString() }, null, 4));
}

export async function removeSharedServicesManifest(context: CliContext): Promise<void> {
    await fs.rm(sharedDir(context), { recursive: true, force: true });
}
