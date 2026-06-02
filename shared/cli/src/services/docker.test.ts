import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run as runCommand } from '../runtime/command-runner.js';
import * as docker from './docker.js';

vi.mock('../runtime/command-runner.js', () => ({
    run: vi.fn(),
}));

describe('container runtime selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        docker.resetContainerRuntimeCacheForTests();
    });

    it('prefers podman and caches the selected runtime', async () => {
        vi.mocked(runCommand).mockResolvedValueOnce({ stdout: 'podman version 5.0.0', stderr: '', status: 0 } as any);

        await docker.run(['ps']);
        await docker.run(['logs', 'container']);

        expect(runCommand).toHaveBeenNthCalledWith(1, 'podman', ['--version'], { capture: true, allowFailure: true });
        expect(runCommand).toHaveBeenNthCalledWith(2, 'podman', ['info'], { quiet: true });
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

        await expect(docker.getContainerRuntime()).resolves.toBe('docker');

        expect(runCommand).toHaveBeenCalledWith('docker', ['info'], { quiet: true });
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

        expect(runCommand).toHaveBeenLastCalledWith('podman', ['volume', 'exists', 'stamhoofd-mysql-data'], { capture: true, quiet: true, allowFailure: true, verbose: false });
    });
});
