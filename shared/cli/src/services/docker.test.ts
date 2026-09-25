import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run as runCommand, RunVerbosity } from '../runtime/command-runner.js';
import * as docker from './docker.js';

vi.mock('../runtime/command-runner.js', async importOriginal => ({
    ...await importOriginal<typeof import('../runtime/command-runner.js')>(),
    run: vi.fn(),
}));

describe('container runtime selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        docker.resetContainerRuntimeCacheForTests();
        delete process.env.STAMHOOFD_CONTAINER_RUNTIME;
    });

    afterEach(() => {
        delete process.env.STAMHOOFD_CONTAINER_RUNTIME;
    });

    it('uses the runtime pinned through STAMHOOFD_CONTAINER_RUNTIME', async () => {
        process.env.STAMHOOFD_CONTAINER_RUNTIME = 'Docker';

        await expect(docker.getContainerRuntime()).resolves.toBe(docker.ContainerRuntime.Docker);

        expect(runCommand).toHaveBeenCalledExactlyOnceWith('docker', ['info'], { verbosity: RunVerbosity.Quiet });
    });

    it('forwards verbosity to runtime and container checks', async () => {
        process.env.STAMHOOFD_CONTAINER_RUNTIME = 'Docker';
        vi.mocked(runCommand).mockResolvedValueOnce(undefined as any).mockResolvedValueOnce({ stdout: 'true\n', stderr: '', status: 0 } as any);

        await expect(docker.getContainerRuntime(RunVerbosity.Output)).resolves.toBe(docker.ContainerRuntime.Docker);
        await expect(docker.containerIsRunning('caddy', RunVerbosity.Output)).resolves.toBe(true);

        expect(runCommand).toHaveBeenNthCalledWith(1, 'docker', ['info'], { verbosity: RunVerbosity.Output });
        expect(runCommand).toHaveBeenNthCalledWith(2, 'docker', ['inspect', '-f', '{{.State.Running}}', 'caddy'], { capture: true, allowFailure: true, verbosity: RunVerbosity.Output });
    });

    it('rejects an unknown pinned runtime', async () => {
        process.env.STAMHOOFD_CONTAINER_RUNTIME = 'containerd';

        await expect(docker.getContainerRuntime()).rejects.toThrow('Unknown STAMHOOFD_CONTAINER_RUNTIME');

        expect(runCommand).not.toHaveBeenCalled();
    });

    it('prefers podman and caches the selected runtime', async () => {
        vi.mocked(runCommand).mockResolvedValueOnce({ stdout: 'podman version 5.0.0', stderr: '', status: 0 } as any);

        await docker.run(['ps']);
        await docker.run(['logs', 'container']);

        expect(runCommand).toHaveBeenNthCalledWith(1, 'podman', ['--version'], { capture: true, allowFailure: true, verbosity: RunVerbosity.Quiet });
        expect(runCommand).toHaveBeenNthCalledWith(2, 'podman', ['info'], { verbosity: RunVerbosity.Quiet });
        expect(runCommand).toHaveBeenNthCalledWith(3, 'podman', ['ps'], {});
        expect(runCommand).toHaveBeenNthCalledWith(4, 'podman', ['logs', 'container'], {});
    });

    it('captures output through the selected runtime', async () => {
        vi.mocked(runCommand)
            .mockResolvedValueOnce({ stdout: 'podman version 5.0.0', stderr: '', status: 0 } as any)
            .mockResolvedValueOnce(undefined as any)
            .mockResolvedValueOnce({ stdout: 'container-list', stderr: '', status: 0 } as any);

        await expect(docker.run(['ps'], { capture: true })).resolves.toEqual({ stdout: 'container-list', stderr: '', status: 0 });

        expect(runCommand).toHaveBeenLastCalledWith('podman', ['ps'], { capture: true });
    });

    it('falls back to docker when podman is not installed', async () => {
        vi.mocked(runCommand).mockResolvedValueOnce({ stdout: '', stderr: 'Error: spawn podman ENOENT', status: 1 } as any);

        await expect(docker.getContainerRuntime()).resolves.toBe(docker.ContainerRuntime.Docker);

        expect(runCommand).toHaveBeenCalledWith('docker', ['info'], { verbosity: RunVerbosity.Quiet });
    });

    it('does not fall back to docker when podman is installed but unusable', async () => {
        vi.mocked(runCommand).mockResolvedValue({ stdout: '', stderr: 'podman version failed', status: 125 } as any);

        await expect(docker.getContainerRuntime()).rejects.toThrow('podman is available but not usable');

        expect(runCommand).toHaveBeenCalledOnce();
    });

    it('does not recreate existing volumes', async () => {
        vi.mocked(runCommand)
            .mockResolvedValueOnce({ stdout: 'podman version 5.0.0', stderr: '', status: 0 } as any)
            .mockResolvedValueOnce(undefined as any)
            .mockResolvedValueOnce({ stdout: '', stderr: '', status: 0 } as any);

        await docker.createVolume('stamhoofd-mysql-data');

        expect(runCommand).toHaveBeenLastCalledWith('podman', ['volume', 'exists', 'stamhoofd-mysql-data'], { capture: true, verbosity: RunVerbosity.Quiet, allowFailure: true });
    });
});
