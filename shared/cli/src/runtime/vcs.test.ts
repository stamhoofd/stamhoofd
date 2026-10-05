import fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { detectVcs, Vcs } from './vcs.js';

vi.mock('./command-runner.js', async original => ({ ...await original<typeof import('./command-runner.js')>(), run: vi.fn() }));
vi.mock('node:fs/promises', () => ({ default: { stat: vi.fn() } }));

describe('VCS detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }));
    });

    it('uses Git when JJ is unavailable, even with a JJ marker', async () => {
        vi.mocked(run).mockResolvedValueOnce({ stdout: '', stderr: 'ENOENT', status: 1 });
        vi.mocked(fs.stat).mockResolvedValue({} as any);
        expect(await detectVcs('/repo')).toBe(Vcs.Git);
        expect(run).toHaveBeenCalledOnce();
        expect(fs.stat).not.toHaveBeenCalled();
    });

    it('uses Git when JJ is installed but the repository is Git-only', async () => {
        vi.mocked(run).mockResolvedValueOnce({ stdout: 'jj 0.45.1', stderr: '', status: 0 });
        vi.mocked(run).mockResolvedValueOnce({ stdout: '', stderr: 'Not a JJ repository', status: 1 });
        expect(await detectVcs('/repo')).toBe(Vcs.Git);
    });

    it('prefers JJ when it recognizes the repository', async () => {
        vi.mocked(run).mockResolvedValueOnce({ stdout: 'jj 0.45.1', stderr: '', status: 0 });
        vi.mocked(run).mockResolvedValueOnce({ stdout: '/primary/.git\n', stderr: '', status: 0 });
        expect(await detectVcs('/workspace', RunVerbosity.Output)).toBe(Vcs.Jj);
        expect(run).toHaveBeenLastCalledWith('jj', ['--ignore-working-copy', 'git', 'root'], { cwd: '/workspace', capture: true, allowFailure: true, verbosity: RunVerbosity.Output });
        expect(fs.stat).not.toHaveBeenCalled();
    });

    it('prefers JJ when its marker exists even if its repository command fails', async () => {
        vi.mocked(run).mockResolvedValueOnce({ stdout: 'jj 0.45.1', stderr: '', status: 0 });
        vi.mocked(run).mockResolvedValueOnce({ stdout: '', stderr: 'Invalid JJ configuration', status: 1 });
        vi.mocked(fs.stat).mockResolvedValue({} as any);
        expect(await detectVcs('/repo')).toBe(Vcs.Jj);
    });
});
