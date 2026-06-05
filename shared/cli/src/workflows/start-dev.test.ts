import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { removeInstanceManifest, writeInstanceManifest } from '../runtime/manifest-store.js';
import { createLiveOutput } from '../runtime/live-output.js';
import { OutputStream, setActiveOutputTarget } from '../runtime/output-target.js';
import { CaddyService } from '../services/definitions/caddy-service.js';
import { startServices, stopServices } from '../services/manager.js';
import { sharedServicesRunning } from '../services/shared-services.js';
import { checkSetup, isSetupReady, printSetupReport } from './setup-machine.js';
import { DevTarget, runDev } from './start-dev.js';

vi.mock('node:child_process', () => ({
    spawn: vi.fn(),
}));

vi.mock('../runtime/manifest-store.js', () => ({
    removeInstanceManifest: vi.fn(),
    writeInstanceManifest: vi.fn(),
}));

vi.mock('../runtime/live-output.js', () => ({
    StatusItemKind: {
        Text: 'text',
        Success: 'success',
        Muted: 'muted',
        Warning: 'warning',
    },
    createLiveOutput: vi.fn(),
}));

vi.mock('../services/definitions/caddy-service.js', () => ({
    CaddyService: {
        reload: vi.fn(),
    },
    caddyService: {},
}));

vi.mock('../services/manager.js', () => ({
    startServices: vi.fn(),
    stopServices: vi.fn(),
}));

vi.mock('../services/shared-services.js', () => ({
    sharedServicesRunning: vi.fn(),
}));

vi.mock('./setup-machine.js', () => ({
    checkSetup: vi.fn(),
    isSetupReady: vi.fn(),
    printSetupReport: vi.fn(),
}));

vi.mock('../services/stripe.js', () => ({
    startStripe: vi.fn(async () => ({})),
    stopStripe: vi.fn(),
}));

vi.mock('../runtime/ux.js', () => ({
    openUrl: vi.fn(),
}));

const context = {
    rootDir: '/repo',
    generatedDir: '/repo/.development/cli/generated',
    env: 'stamhoofd',
    workspace: 'main',
    verbose: false,
    instance: {
        name: 'main',
        prefix: '',
        primary: true,
        portOffset: 0,
    },
} as CliContext;

describe('runDev', () => {
    let signalHandlers: Partial<Record<NodeJS.Signals, NodeJS.SignalsListener>>;
    let liveOutput: { setStatus: ReturnType<typeof vi.fn>; setLiveStatus: ReturnType<typeof vi.fn>; stopLiveStatus: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn>; clearStatus: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.clearAllMocks();
        signalHandlers = {};
        liveOutput = {
            setStatus: vi.fn(),
            setLiveStatus: vi.fn(),
            stopLiveStatus: vi.fn(),
            log: vi.fn(),
            write: vi.fn(),
            clearStatus: vi.fn(),
            stop: vi.fn(),
        };
        vi.mocked(createLiveOutput).mockReturnValue(liveOutput);
        vi.spyOn(process, 'on').mockImplementation((event, listener) => {
            if (event === 'SIGINT' || event === 'SIGTERM') {
                signalHandlers[event] = listener as NodeJS.SignalsListener;
            }
            return process;
        });
        vi.spyOn(process, 'off').mockImplementation((event, listener) => {
            if ((event === 'SIGINT' || event === 'SIGTERM') && signalHandlers[event] === listener) {
                delete signalHandlers[event];
            }
            return process;
        });
        vi.mocked(checkSetup).mockResolvedValue({} as any);
        vi.mocked(isSetupReady).mockReturnValue(true);
        vi.mocked(printSetupReport).mockImplementation(() => undefined);
        vi.mocked(sharedServicesRunning).mockResolvedValue(true);
        vi.mocked(writeInstanceManifest).mockResolvedValue(undefined);
        vi.mocked(removeInstanceManifest).mockResolvedValue(undefined);
        vi.mocked(CaddyService.reload).mockResolvedValue(undefined);
        vi.mocked(startServices).mockResolvedValue({ env: {}, started: [] });
        vi.mocked(stopServices).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        setActiveOutputTarget(undefined);
        vi.restoreAllMocks();
    });

    it('treats Ctrl+C plus child exit status 1 as a normal shutdown', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as any);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);

        signalHandlers.SIGINT?.('SIGINT');
        child.emit('exit', 1);

        await expect(promise).resolves.toBeUndefined();
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('starts app processes through yarn and waits for shared CLI and locale builds', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as any);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);

        expect(spawn).toHaveBeenCalledWith('yarn', [
            '-s',
            'concurrently',
            '-r',
            expect.stringMatching(/rm -f \.development\/cli\/generated\/shared-build-\d+\.ready.+yarn --cwd shared\/cli -s build.+touch \.development\/cli\/generated\/shared-build-\d+\.ready/),
            expect.stringMatching(/wait-on \.development\/cli\/generated\/shared-build-\d+\.ready shared\/cli\/dist\/index\.js shared\/locales\/dist\/index\.d\.ts && yarn -s lerna run dev --scope @stamhoofd\/backend --scope @stamhoofd\/backend-renderer --scope @stamhoofd\/dashboard --scope @stamhoofd\/registration --scope @stamhoofd\/webshop --parallel --stream/),
        ], expect.objectContaining({
            cwd: context.rootDir,
            stdio: ['inherit', 'pipe', 'pipe'],
            env: expect.objectContaining({
                FORCE_COLOR: '1',
                npm_config_color: 'always',
            }),
        }));

        expect(liveOutput.setStatus).toHaveBeenCalledWith([
            { label: `${chalk.dim('https://dashboard.')}${chalk.dim('stamhoofd')}`, href: 'https://dashboard.stamhoofd' },
            { label: `${chalk.dim('https://api.')}${chalk.dim('stamhoofd')}`, href: 'https://api.stamhoofd' },
        ]);

        child.emit('exit', 0);
        await expect(promise).resolves.toBeUndefined();
    });

    it('shows non-Stamhoofd environment domains without duplicating the environment label', async () => {
        vi.mocked(isSetupReady).mockReturnValue(false);

        await expect(runDev({
            ...context,
            env: 'keeo',
            instance: {
                name: 'stamhoofd-keeo',
                prefix: '',
                primary: true,
                portOffset: 100,
            },
        }, 'instance', { services: true, stripe: false })).resolves.toBeUndefined();

        expect(liveOutput.setStatus).toHaveBeenCalledWith([
            { label: `${chalk.dim('https://dashboard.')}${chalk.bold.yellow('keeo')}${chalk.dim('.')}${chalk.dim('stamhoofd')}`, href: 'https://dashboard.keeo.stamhoofd' },
            { label: `${chalk.dim('https://api.')}${chalk.bold.yellow('keeo')}${chalk.dim('.')}${chalk.dim('stamhoofd')}`, href: 'https://api.keeo.stamhoofd' },
            { label: chalk.bold.red('! setup') },
        ]);
    });

    it('shows secondary environment domains with environment before workspace', async () => {
        vi.mocked(isSetupReady).mockReturnValue(false);

        await expect(runDev({
            ...context,
            env: 'keeo',
            workspace: 'feature',
            instance: {
                name: 'stamhoofd-feature-keeo',
                prefix: 'feature',
                primary: false,
                portOffset: 1200,
            },
        }, 'instance', { services: true, stripe: false })).resolves.toBeUndefined();

        expect(liveOutput.setStatus).toHaveBeenCalledWith([
            { label: `${chalk.dim('https://dashboard.')}${chalk.bold.yellow('keeo')}${chalk.dim('.')}${chalk.bold.cyan('feature')}${chalk.dim('.stamhoofd')}`, href: 'https://dashboard.keeo.feature.stamhoofd' },
            { label: `${chalk.dim('https://api.')}${chalk.bold.yellow('keeo')}${chalk.dim('.')}${chalk.bold.cyan('feature')}${chalk.dim('.stamhoofd')}`, href: 'https://api.keeo.feature.stamhoofd' },
            { label: chalk.bold.red('! setup') },
        ]);
    });

    it('shows static status immediately while checking services', async () => {
        const child = createChild();
        const servicesDeferred = deferred<boolean>();
        vi.mocked(spawn).mockReturnValue(child as any);
        vi.mocked(sharedServicesRunning).mockImplementation(async () => await servicesDeferred.promise);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });

        await waitFor(() => liveOutput.setStatus.mock.calls.length > 0);
        expect(liveOutput.setLiveStatus).not.toHaveBeenCalled();

        servicesDeferred.resolve(true);
        await waitFor(() => signalHandlers.SIGINT !== undefined);
        child.emit('exit', 0);
        await expect(promise).resolves.toBeUndefined();
    });

    it('blocks startup and shows setup warning when setup is not ready', async () => {
        vi.mocked(isSetupReady).mockReturnValue(false);

        await expect(runDev(context, DevTarget.Instance, { services: true, stripe: false })).resolves.toBeUndefined();

        expect(printSetupReport).toHaveBeenCalledTimes(1);
        expect(spawn).not.toHaveBeenCalled();
        expect(liveOutput.clearStatus).toHaveBeenCalledTimes(1);
        expect(liveOutput.setStatus).toHaveBeenCalledWith([
            { label: `${chalk.dim('https://dashboard.')}${chalk.dim('stamhoofd')}`, href: 'https://dashboard.stamhoofd' },
            { label: `${chalk.dim('https://api.')}${chalk.dim('stamhoofd')}`, href: 'https://api.stamhoofd' },
            { label: chalk.bold.red('! setup') },
        ]);
    });

    it('blocks startup and shows services warning when services remain unavailable', async () => {
        vi.mocked(sharedServicesRunning).mockResolvedValue(false);

        await expect(runDev(context, DevTarget.Instance, { services: true, stripe: false })).resolves.toBeUndefined();

        expect(spawn).not.toHaveBeenCalled();
        expect(startServices).toHaveBeenCalledTimes(1);
        expect(liveOutput.setStatus).toHaveBeenCalledWith([
            { label: `${chalk.dim('https://dashboard.')}${chalk.dim('stamhoofd')}`, href: 'https://dashboard.stamhoofd' },
            { label: `${chalk.dim('https://api.')}${chalk.dim('stamhoofd')}`, href: 'https://api.stamhoofd' },
            { label: chalk.bold.red('! services') },
        ]);
    });

    it('skips service checks entirely when services are unmanaged', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as any);

        const promise = runDev(context, DevTarget.Instance, { services: false, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);

        expect(checkSetup).toHaveBeenCalledTimes(1);
        expect(sharedServicesRunning).not.toHaveBeenCalled();
        expect(startServices).not.toHaveBeenCalled();

        child.emit('exit', 0);
        await expect(promise).resolves.toBeUndefined();
    });

    it('forwards child stdout and stderr through live output', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as any);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);

        child.stdout.emit('data', 'hello\n');
        child.stderr.emit('data', 'boom\n');
        child.emit('exit', 0);

        await expect(promise).resolves.toBeUndefined();
        expect(liveOutput.write).toHaveBeenNthCalledWith(1, 'hello\n', OutputStream.Stdout);
        expect(liveOutput.write).toHaveBeenNthCalledWith(2, 'boom\n', OutputStream.Stderr);
    });

    it('removes the instance manifest before reloading Caddy during shutdown', async () => {
        const child = createChild();
        const calls: string[] = [];
        vi.mocked(spawn).mockReturnValue(child as any);
        vi.mocked(removeInstanceManifest).mockImplementation(async () => {
            calls.push('remove-manifest');
        });
        vi.mocked(CaddyService.reload).mockImplementation(async () => {
            calls.push('reload-caddy');
        });

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);
        calls.length = 0;

        signalHandlers.SIGINT?.('SIGINT');
        child.emit('exit', 1);

        await expect(promise).resolves.toBeUndefined();
        expect(calls).toEqual(['remove-manifest', 'reload-caddy']);
    });

    it('waits for shutdown cleanup before resolving after a signal', async () => {
        const child = createChild();
        const reload = deferred<void>();
        let resolved = false;
        vi.mocked(spawn).mockReturnValue(child as any);
        vi.mocked(CaddyService.reload)
            .mockResolvedValueOnce(undefined)
            .mockImplementation(async () => await reload.promise);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false }).then(() => {
            resolved = true;
        });
        await waitFor(() => signalHandlers.SIGINT !== undefined);

        signalHandlers.SIGINT?.('SIGINT');
        child.emit('exit', 1);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(resolved).toBe(false);
        expect(signalHandlers.SIGINT).toBeDefined();

        reload.resolve(undefined);
        await expect(promise).resolves.toBeUndefined();
        expect(resolved).toBe(true);
        expect(signalHandlers.SIGINT).toBeUndefined();
    });

    it('ignores an immediate duplicate shutdown signal while cleanup is pending', async () => {
        const child = createChild();
        const reload = deferred<void>();
        vi.mocked(spawn).mockReturnValue(child as any);
        vi.mocked(CaddyService.reload)
            .mockResolvedValueOnce(undefined)
            .mockImplementation(async () => await reload.promise);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);
        vi.useFakeTimers();

        signalHandlers.SIGINT?.('SIGINT');
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');

        expect(() => signalHandlers.SIGINT?.('SIGINT')).not.toThrow();
        expect(child.kill).not.toHaveBeenCalledWith('SIGKILL');

        reload.resolve(undefined);
        await expect(promise).resolves.toBeUndefined();
    });

    it('forces exit on a second shutdown signal after the duplicate signal window', async () => {
        const child = createChild();
        const reload = deferred<void>();
        vi.mocked(spawn).mockReturnValue(child as any);
        vi.mocked(CaddyService.reload)
            .mockResolvedValueOnce(undefined)
            .mockImplementation(async () => await reload.promise);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);
        vi.useFakeTimers();

        signalHandlers.SIGINT?.('SIGINT');
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');
        vi.advanceTimersByTime(751);

        signalHandlers.SIGINT?.('SIGINT');
        expect(child.kill).toHaveBeenCalledWith('SIGKILL');
        expect(liveOutput.clearStatus).toHaveBeenCalledTimes(1);

        reload.resolve(undefined);
        await expect(promise).rejects.toMatchObject({ exitCode: 130, message: 'Forced shutdown. Cleanup may be incomplete.' });
    });

    it('still rejects when the child exits with a non-zero status without a signal', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as any);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);

        child.emit('exit', 1);

        await expect(promise).rejects.toThrow('Development process exited with status 1');
    });

    it('stops live output during shutdown cleanup', async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as any);

        const promise = runDev(context, DevTarget.Instance, { services: true, stripe: false });
        await waitFor(() => signalHandlers.SIGINT !== undefined);

        child.emit('exit', 0);
        await expect(promise).resolves.toBeUndefined();

        expect(liveOutput.stop).toHaveBeenCalledWith({ persistStatus: true });
    });
});

function createChild(): EventEmitter & { kill: ReturnType<typeof vi.fn>; stdout: EventEmitter; stderr: EventEmitter } {
    const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn>; stdout: EventEmitter; stderr: EventEmitter };
    child.kill = vi.fn();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
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
