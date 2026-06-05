import * as commandRunner from '../runtime/command-runner.js';
import type { RunCaptureResult, RunOptions } from '../runtime/command-runner.js';
import { localIpv4Host, mysqlRootPassword, mysqlRootUser } from '../config/shared-service-config.js';

export enum ContainerRuntime {
    Podman = 'podman',
    Docker = 'docker',
}

let containerRuntimePromise: Promise<ContainerRuntime> | undefined;

export async function requireDocker(): Promise<void> {
    await getContainerRuntime();
}

export async function getContainerRuntime(): Promise<ContainerRuntime> {
    containerRuntimePromise ??= resolveContainerRuntime();
    return await containerRuntimePromise;
}

export async function run(args: string[], options: RunOptions & { capture: true }): Promise<RunCaptureResult>;
export async function run(args: string[], options?: RunOptions): Promise<void>;
export async function run(args: string[], options: RunOptions = {}): Promise<void | RunCaptureResult> {
    return await commandRunner.run(await getContainerRuntime(), args, options as RunOptions & { capture: true });
}

export async function containerIsRunning(name: string): Promise<boolean> {
    const result = await run(['inspect', '-f', '{{.State.Running}}', name], { capture: true, allowFailure: true });
    return result.stdout.trim() === 'true';
}

export async function removeContainer(name: string, verbose = false): Promise<void> {
    await run(['rm', '-f', name], { quiet: true, allowFailure: true, verbose });
}

export async function getContainerLogs(name: string, options: { tail?: number } = {}): Promise<string> {
    const result = await run(['logs', '--tail', String(options.tail ?? 50), name], { capture: true, allowFailure: true });
    return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

export async function createVolume(name: string, verbose = false): Promise<void> {
    const existing = await run(['volume', 'exists', name], { capture: true, quiet: true, allowFailure: true, verbose });
    if (existing.status === 0) {
        return;
    }
    await run(['volume', 'create', name], { quiet: true, verbose });
}

export async function removeVolume(name: string, verbose = false): Promise<void> {
    await run(['volume', 'rm', '-f', name], { quiet: true, allowFailure: true, verbose });
}

export async function waitForMysql(container: string, verbose = false): Promise<void> {
    if (verbose) {
        console.log('Waiting for MySQL to accept connections...');
    }
    for (let i = 0; i < 60; i++) {
        const result = await run(['exec', container, 'mysql', `-h${localIpv4Host}`, `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, '-e', 'SELECT 1'], { capture: true, allowFailure: true });
        if (result.status === 0) {
            if (verbose) {
                console.log('MySQL is ready.');
            }
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('MySQL did not become ready in time.');
}

export function resetContainerRuntimeCacheForTests(): void {
    containerRuntimePromise = undefined;
}

async function resolveContainerRuntime(): Promise<ContainerRuntime> {
    const podmanVersion = await commandRunner.run('podman', ['--version'], { capture: true, allowFailure: true });
    if (podmanVersion.status === 0) {
        await commandRunner.run('podman', ['info'], { quiet: true });
        return ContainerRuntime.Podman;
    }
    if (!isCommandNotFound(podmanVersion.stderr)) {
        throw new Error(`podman is available but not usable: ${podmanVersion.stderr.trim() || `exited with status ${podmanVersion.status}`}`);
    }

    await commandRunner.run('docker', ['info'], { quiet: true });
    return ContainerRuntime.Docker;
}

function isCommandNotFound(stderr: string): boolean {
    return stderr.includes('ENOENT');
}
