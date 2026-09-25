import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as commandRunner from '../runtime/command-runner.js';
import { RunVerbosity } from '../runtime/command-runner.js';
import { checkPackageManager, setupPackageManager } from './setup-package-manager.js';

describe('setup package manager workflow', () => {
    let tmpDir: string | undefined;

    afterEach(async () => {
        vi.restoreAllMocks();
        if (tmpDir) {
            await fs.rm(tmpDir, { recursive: true, force: true });
            tmpDir = undefined;
        }
    });

    it('reports when pnpm matches the version pinned with an integrity suffix', async () => {
        tmpDir = await createProject('pnpm@12.4.2+sha512.abcdef');
        const run = vi.spyOn(commandRunner, 'run').mockResolvedValue({ stdout: '12.4.2\n', stderr: '', status: 0 });

        await expect(checkPackageManager(tmpDir)).resolves.toEqual({
            ok: true,
            current: '12.4.2',
            expected: '12.4.2',
            details: 'pnpm 12.4.2 matches package.json',
        });
        expect(run).toHaveBeenCalledWith('pnpm', ['--version'], { capture: true, allowFailure: true, cwd: tmpDir, verbosity: RunVerbosity.Quiet });
    });

    it('reports a missing pnpm executable', async () => {
        tmpDir = await createProject('pnpm@12.4.2');
        vi.spyOn(commandRunner, 'run').mockResolvedValue({ stdout: '', stderr: 'Error: spawn pnpm ENOENT', status: 1 });

        await expect(checkPackageManager(tmpDir)).resolves.toMatchObject({
            ok: false,
            current: undefined,
            expected: '12.4.2',
            details: 'pnpm not found; expected 12.4.2',
        });
    });

    it('reports a pnpm command failure', async () => {
        tmpDir = await createProject('pnpm@12.4.2');
        vi.spyOn(commandRunner, 'run').mockResolvedValue({ stdout: '', stderr: 'pnpm failed', status: 1 });

        await expect(checkPackageManager(tmpDir)).resolves.toMatchObject({
            ok: false,
            current: undefined,
            expected: '12.4.2',
            details: 'pnpm --version failed; expected 12.4.2: pnpm failed',
        });
    });

    it('reports an incorrect pnpm version', async () => {
        tmpDir = await createProject('pnpm@12.4.2');
        vi.spyOn(commandRunner, 'run').mockResolvedValue({ stdout: '11.5.0\n', stderr: '', status: 0 });

        await expect(checkPackageManager(tmpDir)).resolves.toEqual({
            ok: false,
            current: '11.5.0',
            expected: '12.4.2',
            details: 'Expected pnpm 12.4.2, got 11.5.0',
        });
    });

    it('enables Corepack before installing the pinned package manager', async () => {
        tmpDir = await createProject('pnpm@12.4.2');
        const run = vi.spyOn(commandRunner, 'run').mockResolvedValue(undefined);

        await setupPackageManager(tmpDir);

        expect(run.mock.calls).toEqual([
            ['corepack', ['enable'], { cwd: tmpDir, verbosity: RunVerbosity.Output }],
            ['corepack', ['install'], { cwd: tmpDir, verbosity: RunVerbosity.Output }],
        ]);
    });

    it('prints repair commands without running them during a dry run', async () => {
        tmpDir = await createProject('pnpm@12.4.2');
        const run = vi.spyOn(commandRunner, 'run').mockResolvedValue(undefined);
        const messages: string[] = [];
        vi.spyOn(console, 'log').mockImplementation(message => messages.push(String(message)));

        await setupPackageManager(tmpDir, { dryRun: true });

        expect(run).not.toHaveBeenCalled();
        expect(messages.join('\n')).toContain('corepack enable');
        expect(messages.join('\n')).toContain('corepack install');
    });
});

async function createProject(packageManager: string): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-package-manager-'));
    await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ packageManager }));
    return directory;
}
