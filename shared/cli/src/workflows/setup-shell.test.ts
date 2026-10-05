import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from '../runtime/command-runner.js';
import { removeLegacyShellFunction, setupShellShortcut } from './setup-shell.js';

vi.mock(import('../runtime/command-runner.js'), async importOriginal => ({
    ...await importOriginal(),
    run: vi.fn<typeof run>(),
}));
vi.mock('../runtime/ux.js', () => ({ command: (text: string) => text, info: vi.fn(), success: vi.fn() }));

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('../../bin/stam', import.meta.url));
const legacySnippet = '# >>> stam cli >>>\nstam() { echo old; }\n# <<< stam cli <<<\n';

describe('setup-shell', () => {
    let tmpDir: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-shell-'));
        vi.spyOn(os, 'homedir').mockReturnValue(tmpDir);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('installs the standalone executable and removes legacy functions from both shells', async () => {
        for (const name of ['.zshrc', '.bashrc']) {
            await fs.writeFile(path.join(tmpDir, name), `before\n${legacySnippet}after\n`);
        }
        await setupShellShortcut();
        expect(run).toHaveBeenNthCalledWith(1, 'sudo', ['mkdir', '-p', '/usr/local/bin'], { verbosity: RunVerbosity.Output });
        expect(run).toHaveBeenNthCalledWith(2, 'sudo', ['install', '-m', '755', script, '/usr/local/bin/stam'], { verbosity: RunVerbosity.Output });
        expect(await fs.readFile(script, 'utf8')).toMatch(/^#!\/usr\/bin\/env bash\n/);
        for (const name of ['.zshrc', '.bashrc']) {
            expect(await fs.readFile(path.join(tmpDir, name), 'utf8')).toBe('before\nafter\n');
        }
    });

    it('leaves shell configuration intact if installation fails or during a dry run', async () => {
        const rcFile = path.join(tmpDir, '.zshrc');
        await fs.writeFile(rcFile, legacySnippet);
        await setupShellShortcut({ dryRun: true });
        expect(run).not.toHaveBeenCalled();
        expect(await fs.readFile(rcFile, 'utf8')).toBe(legacySnippet);

        vi.mocked(run).mockRejectedValueOnce(new Error('Installation failed'));
        await expect(setupShellShortcut()).rejects.toThrow('Installation failed');
        expect(await fs.readFile(rcFile, 'utf8')).toBe(legacySnippet);
    });

    it('does not create missing shell configuration files', async () => {
        await setupShellShortcut();
        expect(await fs.readdir(tmpDir)).toEqual([]);
    });

    it('removes all complete legacy blocks idempotently and preserves other content', async () => {
        const rcFile = path.join(tmpDir, '.zshrc');
        const unrelated = '# >>> stam cli >>>\nIncomplete block\n';
        await fs.writeFile(rcFile, `before\n${legacySnippet}${legacySnippet}after\n${unrelated}`);
        expect(await removeLegacyShellFunction(rcFile)).toBe(true);
        expect(await fs.readFile(rcFile, 'utf8')).toBe(`before\nafter\n${unrelated}`);
        expect(await removeLegacyShellFunction(rcFile)).toBe(false);
    });

    describe('standalone shortcut', () => {
        let repo: string;
        let bin: string;

        const git = (cwd: string, ...args: string[]) => execFileAsync('git', ['-C', cwd, ...args]);
        const invoke = (cwd: string, exitCode = '0') => execFileAsync(script, ['config', 'value with spaces', '--json'], {
            cwd,
            env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STAM_TEST_PNPM_EXIT: exitCode },
        });
        const expectedArgs = (root: string) => ['--dir', root, '--silent', 'run', 'stam', 'config', 'value with spaces', '--json'];

        beforeEach(async () => {
            repo = path.join(tmpDir, 'checkout with spaces');
            bin = path.join(tmpDir, 'bin');
            await fs.mkdir(repo);
            await fs.mkdir(bin);
            await git(repo, 'init');
            await fs.writeFile(path.join(bin, 'pnpm'), '#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));\nprocess.exit(Number(process.env.STAM_TEST_PNPM_EXIT));\n', { mode: 0o755 });
        });

        it.each([
            'git@github.com:stamhoofd/stamhoofd.git',
            'https://github.com/stamhoofd/stamhoofd',
            'ssh://git@github.com/stamhoofd/stamhoofd.git',
        ])('delegates from nested directories using remote %s', async (remote) => {
            await git(repo, 'remote', 'add', 'upstream', remote);
            const nested = path.join(repo, 'work/nested');
            await fs.mkdir(nested, { recursive: true });
            const result = await invoke(nested);
            expect(JSON.parse(result.stdout)).toEqual(expectedArgs(repo));
            expect(result.stderr).toBe('');
            await expect(invoke(nested, '17')).rejects.toMatchObject({ code: 17 });
        });

        it('finds the parent checkout from a nested DevOps repository', async () => {
            await git(repo, 'remote', 'add', 'origin', 'git@github.com:stamhoofd/stamhoofd.git');
            const devops = path.join(repo, 'devops');
            await fs.mkdir(devops);
            await git(devops, 'init');
            await git(devops, 'remote', 'add', 'origin', 'git@github.com:stamhoofd/devops.git');
            expect(JSON.parse((await invoke(devops)).stdout)).toEqual(expectedArgs(repo));
        });

        it('uses the current worktree rather than the original clone', async () => {
            await git(repo, 'remote', 'add', 'origin', 'https://github.com/stamhoofd/stamhoofd.git');
            await git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'Initial commit');
            const worktree = path.join(tmpDir, 'worktree');
            await git(repo, 'worktree', 'add', '--detach', worktree);
            expect(JSON.parse((await invoke(worktree)).stdout)).toEqual(expectedArgs(worktree));
        });

        it('rejects unrelated repositories and directories outside Git', async () => {
            await git(repo, 'remote', 'add', 'origin', 'https://github.com/stamhoofd/stamhoofd-other.git');
            for (const cwd of [repo, tmpDir]) {
                await expect(invoke(cwd)).rejects.toMatchObject({
                    code: 1,
                    stdout: '',
                    stderr: expect.stringContaining('not inside a repository with a stamhoofd/stamhoofd GitHub remote'),
                });
            }
        });
    });
});
