import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildShellSnippet, defaultRcFile, detectShellKind, installShellFunction, SHELL_SNIPPET_END, SHELL_SNIPPET_START } from './setup-shell.js';

const execFileAsync = promisify(execFile);

describe('setup-shell', () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-shell-'));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    describe('detectShellKind', () => {
        it('detects bash from the shell path', () => {
            expect(detectShellKind('/bin/bash')).toBe('bash');
            expect(detectShellKind('/usr/local/bin/bash')).toBe('bash');
        });

        it('defaults to zsh', () => {
            expect(detectShellKind('/bin/zsh')).toBe('zsh');
            expect(detectShellKind(undefined)).toBe('zsh');
            expect(detectShellKind('/usr/bin/fish')).toBe('zsh');
        });
    });

    describe('defaultRcFile', () => {
        it('maps shells to their rc files', () => {
            expect(defaultRcFile('bash', '/home/me')).toBe('/home/me/.bashrc');
            expect(defaultRcFile('zsh', '/home/me')).toBe('/home/me/.zshrc');
        });
    });

    describe('installShellFunction', () => {
        it('creates a new rc file with the snippet', async () => {
            const rcFile = path.join(tmpDir, '.zshrc');

            const result = await installShellFunction(rcFile);

            expect(result.action).toBe('created');
            const content = await fs.readFile(rcFile, 'utf8');
            expect(content).toBe(`${buildShellSnippet()}\n`);
        });

        it('appends to an existing file without a trailing newline', async () => {
            const rcFile = path.join(tmpDir, '.zshrc');
            await fs.writeFile(rcFile, 'export FOO=bar');

            const result = await installShellFunction(rcFile);

            expect(result.action).toBe('updated');
            const content = await fs.readFile(rcFile, 'utf8');
            expect(content).toBe(`export FOO=bar\n\n${buildShellSnippet()}\n`);
        });

        it('is idempotent and reports unchanged on a second run', async () => {
            const rcFile = path.join(tmpDir, '.zshrc');
            await fs.writeFile(rcFile, 'export FOO=bar\n');

            await installShellFunction(rcFile);
            const afterFirst = await fs.readFile(rcFile, 'utf8');

            const second = await installShellFunction(rcFile);
            const afterSecond = await fs.readFile(rcFile, 'utf8');

            expect(second.action).toBe('unchanged');
            expect(afterSecond).toBe(afterFirst);
            expect(afterSecond.match(/stam\(\) \{/g)).toHaveLength(1);
        });

        it('replaces an outdated snippet in place', async () => {
            const rcFile = path.join(tmpDir, '.zshrc');
            const stale = `${SHELL_SNIPPET_START}\nstam() { echo old; }\n${SHELL_SNIPPET_END}`;
            await fs.writeFile(rcFile, `before\n${stale}\nafter\n`);

            const result = await installShellFunction(rcFile);

            expect(result.action).toBe('updated');
            const content = await fs.readFile(rcFile, 'utf8');
            expect(content).toBe(`before\n${buildShellSnippet()}\nafter\n`);
            expect(content).not.toContain('echo old');
        });
    });

    it('builds the optional DevOps CLI before launching from a nested directory', async () => {
        const cli = path.join(tmpDir, 'shared/cli');
        const devops = path.join(tmpDir, 'devops');
        const nested = path.join(tmpDir, 'work/nested');
        const bin = path.join(tmpDir, 'bin');
        const calls = path.join(tmpDir, 'calls');
        await fs.mkdir(path.join(cli, 'bin'), { recursive: true });
        await fs.mkdir(path.join(cli, 'dist'), { recursive: true });
        await fs.mkdir(nested, { recursive: true });
        await fs.mkdir(bin);
        await fs.writeFile(path.join(cli, 'dist/index.js'), '');
        await fs.writeFile(path.join(cli, 'bin/stam.js'), '#!/bin/sh\nprintf "launched %s\\n" "$*" >> "$STAM_TEST_CALLS"\n', { mode: 0o755 });
        await fs.writeFile(path.join(bin, 'pnpm'), '#!/bin/sh\nprintf "build %s\\n" "$*" >> "$STAM_TEST_CALLS"\nexit "${STAM_TEST_PNPM_EXIT:-0}"\n', { mode: 0o755 });

        const run = (exitCode?: string) => execFileAsync('bash', ['-c', `${buildShellSnippet()}\nstam --help`], {
            cwd: nested,
            env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STAM_TEST_CALLS: calls, STAM_TEST_PNPM_EXIT: exitCode },
        });

        await run();
        expect(await fs.readFile(calls, 'utf8')).toBe('launched --help\n');

        await fs.mkdir(devops);
        await fs.writeFile(path.join(devops, 'tsconfig.cli.json'), '{}');
        await run();
        expect(await fs.readFile(calls, 'utf8')).toBe(`launched --help\nbuild --dir ${devops} run build:cli\nlaunched --help\n`);

        await expect(run('17')).rejects.toMatchObject({ code: 17 });
        expect(await fs.readFile(calls, 'utf8')).toBe(`launched --help\nbuild --dir ${devops} run build:cli\nlaunched --help\nbuild --dir ${devops} run build:cli\n`);
    });
});
