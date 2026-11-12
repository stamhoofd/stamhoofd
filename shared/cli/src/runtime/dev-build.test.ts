import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import type { DevEvent } from '@node/dev-tools/events';
import { openDevEventChannel } from './dev-event-channel.js';
import { buildPorts } from '../context/ports.js';
import type { CliContext } from '../context/create-context.js';

it('assigns distinct inspector ports to concurrently running backend apps', () => {
    const allocated = buildPorts({ instance: { portOffset: 1200 } } as CliContext);
    const ports = [allocated.apiInspector, allocated.rendererInspector, allocated.statsInspector];
    expect(ports.every(Boolean)).toBe(true);
    expect(new Set(ports).size).toBe(3);
});

it('reports real TypeScript watch failures and recovery without parsing compiler output', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-build-test-'));
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel((event) => events.push(event));
    await fs.writeFile(
        path.join(directory, 'tsconfig.build.json'),
        JSON.stringify({
            compilerOptions: { composite: true, outDir: 'dist', types: [], skipLibCheck: true },
            include: ['index.ts'],
        }),
    );
    await fs.writeFile(path.join(directory, 'index.ts'), 'export const value: string = 123;');
    const script = fileURLToPath(import.meta.resolve('@node/dev-tools/watch-typescript'));
    const child = spawn(process.execPath, [script, 'api'], {
        cwd: directory,
        env: { ...process.env, ...channel.env },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    try {
        await expect
            .poll(() => events.some((event) => event.event === 'build.failed'), { timeout: 10_000 })
            .toBe(true);
        expect(output).toContain('TS2322');
        expect(output).not.toContain('Starting compilation');
        expect(output).not.toContain('Watching for file changes');
        expect(events.find((event) => event.event === 'build.failed')?.errors).toBe(1);
        await fs.writeFile(
            path.join(directory, 'index.ts'),
            'export const value: string = "fixed";',
        );
        await expect
            .poll(() => events.some((event) => event.event === 'build.succeeded'), {
                timeout: 10_000,
            })
            .toBe(true);
        expect(events.map((event) => event.event)).toEqual([
            'build.started',
            'build.failed',
            'build.started',
            'build.succeeded',
        ]);
        expect(events[0].cycleId).not.toBe(events[2].cycleId);
        expect(await fs.readFile(path.join(directory, 'dist/index.js'), 'utf8')).toContain('fixed');
    } finally {
        child.kill('SIGTERM');
        await once(child, 'close');
        await channel.close();
        await fs.rm(directory, { recursive: true, force: true });
    }
}, 25_000);
