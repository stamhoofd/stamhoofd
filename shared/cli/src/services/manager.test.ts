import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { ContainerStoppedError } from './docker-service.js';
import { printServicesStatus, restartServicesInteractive, startServicesInteractive, stopServicesInteractive } from './manager.js';
import type { ServiceDefinition, ServiceStartResult, ServiceStatus } from './service.js';

const tableMock = vi.hoisted(() => {
    type MockRow = {
        cells: any[];
        update: ReturnType<typeof vi.fn>;
        hasIndeterminateCells: () => boolean;
    };
    const createdTables: { rows: MockRow[]; wait: ReturnType<typeof vi.fn> }[] = [];

    return {
        createdTables,
        Table: {
            cell: vi.fn((value: string, options = {}) => ({ value, ...options })),
            row: vi.fn((cells: any[]) => {
                const row: MockRow = {
                    cells,
                    update: vi.fn((updatedCells: any[]) => {
                        row.cells = updatedCells;
                    }),
                    hasIndeterminateCells: () => row.cells.some(cell => typeof cell !== 'string' && cell.indeterminate),
                };
                return row;
            }),
            create: vi.fn((options: { rows: MockRow[] }) => {
                const created = { rows: options.rows, wait: vi.fn(async () => undefined) };
                createdTables.push(created);
                return created;
            }),
        },
    };
});

vi.mock('../runtime/ux.js', () => ({
    Table: tableMock.Table,
    statusCell: vi.fn((status: string) => status),
    step: vi.fn(),
    table: vi.fn(),
}));

const context = {} as CliContext;

describe('service manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tableMock.createdTables.length = 0;
    });

    it('prints service status with login details', async () => {
        const services = [
            {
                key: 'maildev',
                name: 'MailDev',
                async status(): Promise<ServiceStatus> {
                    return { name: 'MailDev', running: true, detail: 'https://mail.stamhoofd', login: 'username / password' };
                },
                async start(): Promise<ServiceStartResult> {
                    return { message: 'started' };
                },
                async stop(): Promise<string> {
                    return 'stopped';
                },
            } satisfies ServiceDefinition<void>,
        ];

        await printServicesStatus(context, services);

        expect(tableMock.Table.create).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Shared services',
            headers: ['Service', 'Status', 'Access', 'Login'],
            live: true,
        }));
        expect(tableMock.createdTables.at(-1)?.rows[0].cells).toEqual([
            'MailDev',
            expect.stringContaining('running'),
            'https://mail.stamhoofd',
            'username / password',
        ]);
    });

    it('starts services concurrently and returns env and started keys', async () => {
        const first = deferred<void>();
        const second = deferred<void>();
        let runningStarts = 0;
        let maxRunningStarts = 0;

        const services = [
            testService('first', first.promise, () => {
                runningStarts++;
                maxRunningStarts = Math.max(maxRunningStarts, runningStarts);
            }, () => runningStarts--),
            testService('second', second.promise, () => {
                runningStarts++;
                maxRunningStarts = Math.max(maxRunningStarts, runningStarts);
            }, () => runningStarts--),
        ];

        const resultPromise = startServicesInteractive(context, services);
        await waitFor(() => maxRunningStarts === 2);

        first.resolve(undefined);
        second.resolve(undefined);

        await expect(resultPromise).resolves.toEqual({
            env: { FIRST: '1', SECOND: '1' },
            started: ['first', 'second'],
        });
    });

    it('stops services concurrently', async () => {
        const first = deferred<void>();
        const second = deferred<void>();
        let runningStops = 0;
        let maxRunningStops = 0;

        const services = [
            testService('first', first.promise, () => undefined, () => undefined, first.promise, () => {
                runningStops++;
                maxRunningStops = Math.max(maxRunningStops, runningStops);
            }, () => runningStops--),
            testService('second', second.promise, () => undefined, () => undefined, second.promise, () => {
                runningStops++;
                maxRunningStops = Math.max(maxRunningStops, runningStops);
            }, () => runningStops--),
        ];

        const resultPromise = stopServicesInteractive(context, services);
        await waitFor(() => maxRunningStops === 2);

        first.resolve(undefined);
        second.resolve(undefined);

        await expect(resultPromise).resolves.toBeUndefined();
    });

    it('restarts services concurrently and returns env and started keys', async () => {
        const firstStop = deferred<void>();
        const secondStop = deferred<void>();
        const firstStart = deferred<void>();
        const secondStart = deferred<void>();
        let runningStops = 0;
        let maxRunningStops = 0;
        let runningStarts = 0;
        let maxRunningStarts = 0;

        const services = [
            testService('first', firstStart.promise, () => {
                runningStarts++;
                maxRunningStarts = Math.max(maxRunningStarts, runningStarts);
            }, () => runningStarts--, firstStop.promise, () => {
                runningStops++;
                maxRunningStops = Math.max(maxRunningStops, runningStops);
            }, () => runningStops--),
            testService('second', secondStart.promise, () => {
                runningStarts++;
                maxRunningStarts = Math.max(maxRunningStarts, runningStarts);
            }, () => runningStarts--, secondStop.promise, () => {
                runningStops++;
                maxRunningStops = Math.max(maxRunningStops, runningStops);
            }, () => runningStops--),
        ];

        const resultPromise = restartServicesInteractive(context, services);
        await waitFor(() => maxRunningStops === 2);

        firstStop.resolve(undefined);
        secondStop.resolve(undefined);
        await waitFor(() => maxRunningStarts === 2);

        firstStart.resolve(undefined);
        secondStart.resolve(undefined);

        await expect(resultPromise).resolves.toEqual({
            env: { FIRST: '1', SECOND: '1' },
            started: ['first', 'second'],
        });
    });

    it('ellipsizes live table access details to avoid wrapped rows', async () => {
        const originalColumns = process.stdout.columns;
        Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 80 });
        const errorMessage = 'x'.repeat(400);

        try {
            await expect(startServicesInteractive(context, [{
                key: 'coredns',
                name: 'CoreDNS',
                async status(): Promise<ServiceStatus> {
                    return { name: 'CoreDNS', running: false, detail: 'stopped' };
                },
                async start(): Promise<ServiceStartResult> {
                    throw new Error(errorMessage);
                },
                async stop(): Promise<string> {
                    return 'stopped';
                },
            }])).rejects.toThrow(errorMessage);

            const rows = tableMock.createdTables.at(-1)?.rows.map(row => row.cells) ?? [];

            expect(rows[0][2]).toHaveLength(49);
            expect(rows[0][2]).toMatch(/…$/);
        }
        finally {
            Object.defineProperty(process.stdout, 'columns', { configurable: true, value: originalColumns });
        }
    });

    it('shows the last log line in the table and prints logs below it', async () => {
        const messages: string[] = [];
        const original = console.log;
        console.log = (message?: unknown) => {
            messages.push(typeof message === 'string' ? message : '');
        };

        try {
            await expect(startServicesInteractive(context, [{
                key: 'coredns',
                name: 'CoreDNS',
                async status(): Promise<ServiceStatus> {
                    return { name: 'CoreDNS', running: false, detail: 'stopped' };
                },
                async start(): Promise<ServiceStartResult> {
                    throw new ContainerStoppedError('CoreDNS stopped immediately after start', 'CoreDNS', 'last log line', 'first line\nlast log line');
                },
                async stop(): Promise<string> {
                    return 'stopped';
                },
            }])).rejects.toThrow('CoreDNS stopped immediately after start');

            const rows = tableMock.createdTables.at(-1)?.rows.map(row => row.cells) ?? [];
            expect(rows[0][2]).toBe('last log line');
            expect(messages.join('\n')).toContain('Logs for CoreDNS:');
            expect(messages.join('\n')).toContain('first line\nlast log line');
        }
        finally {
            console.log = original;
        }
    });
});

function testService(key: string, startWait: Promise<void>, onStart: () => void, onStartDone: () => void, stopWait = Promise.resolve(), onStop: () => void = () => undefined, onStopDone: () => void = () => undefined): ServiceDefinition<void> {
    let statusCalls = 0;

    return {
        key,
        name: key,
        async status(): Promise<ServiceStatus> {
            statusCalls++;
            return { name: key, running: statusCalls > 1, detail: `${key}-detail`, login: `${key}-login` };
        },
        async start(): Promise<ServiceStartResult> {
            onStart();
            await startWait;
            onStartDone();
            return { message: `${key} started`, env: { [key.toUpperCase()]: '1' } };
        },
        async stop(): Promise<string> {
            onStop();
            await stopWait;
            onStopDone();
            return `${key} stopped`;
        },
    };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

async function waitFor(condition: () => boolean): Promise<void> {
    for (let i = 0; i < 20; i++) {
        if (condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    throw new Error('Condition was not met.');
}
