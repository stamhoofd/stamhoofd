import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { backendDevCommand } from './dev-commands.js';
import type { DevEvent } from '@node/dev-tools/events';
import { expect, it } from 'vitest';
import { openDevEventChannel } from './dev-event-channel.js';

it('compiles, restarts and shuts down a backend using the CLI-owned watch command', async () => {
    const root = resolve(import.meta.dirname, '../../../..');
    const fixture = await mkdtemp(join(root, '.development/dev-watch-'));
    const cwd = join(fixture, "arbitrary depth/renderer's workspace/app");
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel(event => events.push(event));
    await mkdir(cwd, { recursive: true });
    await writeFile(join(cwd, 'package.json'), JSON.stringify({ type: 'module' }));
    await writeFile(join(cwd, 'tsconfig.build.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', outDir: 'dist', skipLibCheck: true, types: ['node'] }, include: ['index.ts'] }));
    const source = (value: string) => `
        import { channel } from 'node:diagnostics_channel';
        console.log('${value}');
        channel('stamhoofd.application.lifecycle').publish({ service: 'renderer', event: 'ready' });
        setInterval(() => {}, 1000);
        process.on('SIGTERM', () => { console.log('shutdown'); process.exit(0); });
    `;
    await writeFile(join(cwd, 'index.ts'), source('first'));
    // Exercise the same shell composition as stam; the command contains only repository-owned constants.
    // eslint-disable-next-line node-security/no-dynamic-command-string
    const child = spawn('sh', ['-c', backendDevCommand(root, 'renderer')], {
        cwd,
        env: { ...process.env, ...channel.env, PATH: `${join(root, 'node_modules/.bin')}:${process.env.PATH}` },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const closed = once(child, 'close');
    let output = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    try {
        await expect.poll(() => output, { timeout: 20000 }).toContain('first');
        await expect.poll(() => events.some(event => event.event === 'ready')).toBe(true);
        await writeFile(join(cwd, 'index.ts'), source('second'));
        await expect.poll(() => output, { timeout: 20000 }).toContain('second');
        await expect.poll(() => events.filter(event => event.event === 'ready').length).toBe(2);
        expect(events.filter(event => event.event === 'build.succeeded').length).toBeGreaterThanOrEqual(2);
        expect(new Set(events.filter(event => event.event === 'ready').map(event => event.processId)).size).toBe(2);
        process.kill(-child.pid!, 'SIGTERM');
        await closed;
        expect(output.match(/shutdown/g)?.length).toBe(2);
    } finally {
        try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* Process group already exited. */ }
        await closed;
        await channel.close();
        await rm(fixture, { recursive: true, force: true });
    }
}, 45000);
