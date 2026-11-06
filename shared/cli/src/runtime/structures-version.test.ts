import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { increaseStructuresVersion } from './structures-version.js';
import { detectVcs, Vcs } from './vcs.js';

vi.mock('./command-runner.js', async original => ({ ...await original<typeof import('./command-runner.js')>(), run: vi.fn() }));
vi.mock('./vcs.js', async original => ({ ...await original<typeof import('./vcs.js')>(), detectVcs: vi.fn() }));
vi.mock('./ux.js', () => ({ info: vi.fn(), success: vi.fn(), warning: vi.fn(), command: vi.fn() }));

const versionFile = 'shared/structures/src/Version.ts';

describe('increaseStructuresVersion', () => {
    let cwd: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(detectVcs).mockResolvedValue(Vcs.Git);
        cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'structures-version-'));
        await fs.mkdir(path.join(cwd, versionFile, '..'), { recursive: true });
        await fs.writeFile(path.join(cwd, versionFile), 'export const Version = 12;\n');
    });

    afterEach(async () => {
        await fs.rm(cwd, { recursive: true, force: true });
    });

    async function writePendingField(): Promise<string> {
        const filePath = path.join(cwd, 'shared/structures/src/Member.ts');
        await fs.writeFile(filePath, '@field({ decoder: StringDecoder, ...NextVersion })\nname: string;\n');
        return filePath;
    }

    it('replaces the pending fields, bumps Version.ts and commits with Git without pushing', async () => {
        const filePath = await writePendingField();

        await increaseStructuresVersion({ cwd, force: true });

        expect(await fs.readFile(filePath, 'utf8')).toContain('version: 13');
        expect(await fs.readFile(path.join(cwd, versionFile), 'utf8')).toContain('Version = 13');
        expect(vi.mocked(run).mock.calls.map(([command, args]) => [command, ...args])).toEqual([
            ['git', 'add', '.'],
            ['git', 'commit', '-m', 'Increased structures to version 13'],
        ]);
    });

    it('commits with JJ, which snapshots the working copy and has no add step', async () => {
        vi.mocked(detectVcs).mockResolvedValue(Vcs.Jj);
        await writePendingField();

        await increaseStructuresVersion({ cwd, force: true, verbosity: RunVerbosity.Output });

        expect(detectVcs).toHaveBeenCalledWith(cwd, RunVerbosity.Output);
        expect(run).toHaveBeenCalledExactlyOnceWith('jj', ['commit', '-m', 'Increased structures to version 13'], { cwd, verbosity: RunVerbosity.Output });
    });

    it('does nothing when no pending fields are used', async () => {
        await increaseStructuresVersion({ cwd, force: true });

        expect(await fs.readFile(path.join(cwd, versionFile), 'utf8')).toContain('Version = 12');
        expect(run).not.toHaveBeenCalled();
        expect(detectVcs).not.toHaveBeenCalled();
    });

    it('reports the pending fields without writing or committing on a dry run', async () => {
        const filePath = await writePendingField();
        const before = await fs.readFile(filePath, 'utf8');

        await increaseStructuresVersion({ cwd, dryRun: true });

        expect(await fs.readFile(filePath, 'utf8')).toBe(before);
        expect(await fs.readFile(path.join(cwd, versionFile), 'utf8')).toContain('Version = 12');
        expect(run).not.toHaveBeenCalled();
    });
});
