import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it.skipIf(process.platform === 'win32').each(['bootstrap', 'shortcut'])('keeps the %s foreground process alive until interrupted CLI cleanup completes', async (launcher) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-launcher-'));
    let child: ReturnType<typeof spawn> | undefined;
    try {
        await fs.mkdir(path.join(root, '.development'));
        await fs.mkdir(path.join(root, 'shared/cli/bin'), { recursive: true });
        await fs.mkdir(path.join(root, 'bin'));
        await fs.copyFile(fileURLToPath(new URL('../../../../.development/stam.mjs', import.meta.url)), path.join(root, '.development/stam.mjs'));
        await fs.copyFile(fileURLToPath(new URL('../../bin/stam', import.meta.url)), path.join(root, 'bin/stam'));
        await fs.writeFile(path.join(root, 'bin/pnpm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        await fs.writeFile(path.join(root, 'bin/git'), '#!/bin/sh\nif [ "$3" = "rev-parse" ]; then echo "$STAM_TEST_ROOT"; else echo "origin https://github.com/stamhoofd/stamhoofd (fetch)"; fi\n', { mode: 0o755 });
        await fs.writeFile(path.join(root, 'shared/cli/bin/stam.js'), `
            const keepAlive = setInterval(() => {}, 1000);
            process.once('SIGINT', () => {
                setTimeout(() => {
                    process.stdout.write('cleanup complete\\n');
                    clearInterval(keepAlive);
                }, 100);
            });
            process.stdout.write('ready\\n');
        `);
        child = spawn(launcher === 'bootstrap' ? process.execPath : 'bash', [path.join(root, launcher === 'bootstrap' ? '.development/stam.mjs' : 'bin/stam')], {
            cwd: root, detached: true, env: { ...process.env, STAM_TEST_ROOT: root, PATH: `${path.join(root, 'bin')}:${process.env.PATH}` },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        let interrupted = false;
        child.stdout!.on('data', (chunk: Buffer) => {
            output += chunk.toString();
            if (!interrupted && output.includes('ready\n')) {
                interrupted = true;
                process.kill(-child!.pid!, 'SIGINT');
            }
        });
        const closed = once(child, 'close');
        await once(child, 'exit');
        const outputAtExit = output;
        await closed;
        expect(interrupted).toBe(true);
        expect(outputAtExit).toContain('cleanup complete\n');
    } finally {
        if (child?.pid) {
            try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { expect((error as NodeJS.ErrnoException).code).toBe('ESRCH'); }
        }
        await fs.rm(root, { recursive: true, force: true });
    }
});
