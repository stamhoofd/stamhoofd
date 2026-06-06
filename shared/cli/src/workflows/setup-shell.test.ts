import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildShellSnippet, defaultRcFile, detectShellKind, installShellFunction, SHELL_SNIPPET_END, SHELL_SNIPPET_START } from './setup-shell.js';

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
});
