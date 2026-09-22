import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../runtime/command-runner.js';
import { resolvePrimaryInstance, resolvePrimaryWorkspaceRoot } from './workspace.js';

vi.mock('../runtime/command-runner.js', async importOriginal => ({
    ...await importOriginal<typeof import('../runtime/command-runner.js')>(),
    run: vi.fn(),
}));

describe('resolvePrimaryInstance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    it('uses the explicit primary override', async () => {
        vi.stubEnv('STAMHOOFD_PRIMARY_INSTANCE', '1');

        await expect(resolvePrimaryInstance('/repo/b')).resolves.toBe(true);
        expect(run).not.toHaveBeenCalled();
    });

    it('detects the first Git worktree as primary', async () => {
        mockJjFailure();
        mockGitWorktrees('/repo/a', '/repo/b');

        await expect(resolvePrimaryInstance('/repo/a')).resolves.toBe(true);
    });

    it('detects later Git worktrees as secondary', async () => {
        mockJjFailure();
        mockGitWorktrees('/repo/a', '/repo/b');

        await expect(resolvePrimaryInstance('/repo/b')).resolves.toBe(false);
    });

    it('detects the first jj workspace as primary', async () => {
        mockJjWorkspaces(['a', '/repo/a'], ['b', '/repo/b']);

        await expect(resolvePrimaryInstance('/repo/a')).resolves.toBe(true);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('detects later jj workspaces as secondary', async () => {
        mockJjWorkspaces(['a', '/repo/a'], ['b', '/repo/b']);

        await expect(resolvePrimaryInstance('/repo/b')).resolves.toBe(false);
    });

    it('uses the default jj workspace for shared services even when another name sorts first', async () => {
        mockJjWorkspaces(['cleanup', '/repo/cleanup'], ['default', '/repo/main'], ['turborepo', '/repo/turborepo']);

        await expect(resolvePrimaryWorkspaceRoot('/repo/turborepo')).resolves.toBe('/repo/main');
    });

    it('does not mark an alphabetically earlier jj workspace as primary', async () => {
        mockJjWorkspaces(['cleanup', '/repo/cleanup'], ['default', '/repo/main']);

        await expect(resolvePrimaryInstance('/repo/cleanup')).resolves.toBe(false);
    });

    it('falls back to secondary when no VCS workspace list is available', async () => {
        mockJjFailure();
        mockGitFailure();

        await expect(resolvePrimaryInstance('/repo/a')).resolves.toBe(false);
    });
});

function mockJjFailure() {
    vi.mocked(run).mockResolvedValueOnce({ stdout: '', stderr: 'not a jj repo', status: 1 });
}

function mockGitFailure() {
    vi.mocked(run).mockResolvedValueOnce({ stdout: '', stderr: 'not a git repo', status: 1 });
}

function mockJjWorkspaces(...workspaces: Array<[string, string]>) {
    vi.mocked(run).mockResolvedValueOnce({ stdout: workspaces.map(([name, root]) => `${name}\t${root}`).join('\n'), stderr: '', status: 0 });
}

function mockGitWorktrees(...roots: string[]) {
    vi.mocked(run).mockResolvedValueOnce({
        stdout: roots.map(root => `worktree ${root}\nHEAD 0000000000000000000000000000000000000000`).join('\n\n'),
        stderr: '',
        status: 0,
    });
}
