import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { expect, it, vi } from 'vitest';
import type { DevEvent } from '@node/dev-tools/events';
import { devLifecycleModule } from '@node/dev-tools/nuxt';
import { devLifecyclePlugin } from '@node/dev-tools/vite';
import { openDevEventChannel } from './dev-event-channel.js';

it('reports readiness and crashes with the same supervised identity, then assigns a new incarnation', async () => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel(event => events.push(event));
    const supervisor = fileURLToPath(import.meta.resolve('@node/dev-tools/supervise'));
    const emitter = import.meta.resolve('@node/dev-tools/events');
    try {
        for (let run = 0; run < 2; run++) {
            const child = spawn(process.execPath, [supervisor, 'api', process.execPath, '--input-type=module', '-e', `import { createDevEmitter } from '${emitter}'; const e = createDevEmitter('api'); e.emit('ready'); await e.close(); process.exit(7);`], { env: { ...process.env, ...channel.env }, stdio: 'ignore' });
            expect((await once(child, 'close'))[0]).toBe(7);
            await expect.poll(() => events.length).toBe((run + 1) * 3);
        }
        for (const batch of [events.slice(0, 3), events.slice(3)]) {
            expect(batch.map(event => event.event)).toEqual(['starting', 'ready', 'stopped']);
            expect(new Set(batch.map(event => event.processId)).size).toBe(1);
            expect(batch[2].failed).toBe(true);
        }
        expect(events[0].processId).not.toBe(events[3].processId);
        expect(BigInt(events[3].generation)).toBeGreaterThan(BigInt(events[0].generation));
    } finally {
        await channel.close();
    }
});

it('emits Vite readiness only when its HTTP listener opens', async () => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel(event => events.push(event));
    for (const [key, value] of Object.entries(channel.env)) vi.stubEnv(key, value);
    const server = http.createServer();
    const plugin = devLifecyclePlugin('dashboard');
    try {
        plugin.configureServer({ httpServer: server });
        await expect.poll(() => events.length).toBe(1);
        expect(events[0].event).toBe('starting');
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        await expect.poll(() => events.at(-1)?.event).toBe('ready');
    } finally {
        await plugin.closeBundle();
        if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
        vi.unstubAllEnvs();
        await channel.close();
    }
});

it('reports supervised cancellation without a process failure', async () => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel(event => events.push(event));
    const supervisor = fileURLToPath(import.meta.resolve('@node/dev-tools/supervise'));
    const emitter = import.meta.resolve('@node/dev-tools/events');
    const child = spawn(process.execPath, [supervisor, 'api', process.execPath, '--input-type=module', '-e', `import { createDevEmitter } from '${emitter}'; process.on('SIGTERM', () => process.exit(0)); const e = createDevEmitter('api'); e.emit('ready'); await e.close(); setInterval(() => {}, 1000);`], { env: { ...process.env, ...channel.env }, stdio: 'ignore' });
    const closed = once(child, 'close');
    try {
        await expect.poll(() => events.some(event => event.event === 'ready')).toBe(true);
        child.kill('SIGTERM');
        expect((await closed)[0]).toBe(0);
        await expect.poll(() => events.at(-1)?.event).toBe('stopped');
        expect(events.at(-1)?.failed).toBe(false);
    } finally {
        if (child.exitCode === null) child.kill('SIGTERM');
        await closed;
        await channel.close();
    }
});

it.each([true, false])('waits for both Nuxt compilation and its listener (listen first: %s)', async (listenFirst) => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel(event => events.push(event));
    for (const [key, value] of Object.entries(channel.env)) vi.stubEnv(key, value);
    const hooks = new Map<string, (...args: any[]) => void | Promise<void>>();
    const nitroHooks = new Map<string, () => void>();
    try {
        await devLifecycleModule({}, { options: { dev: true }, hook: (name: string, callback: () => void) => hooks.set(name, callback) });
        await hooks.get('build:before')!();
        await hooks.get(listenFirst ? 'listen' : 'build:done')!();
        await expect.poll(() => events.length).toBe(listenFirst ? 2 : 3);
        expect(events.some(event => event.event === 'ready')).toBe(false);
        await hooks.get(listenFirst ? 'build:done' : 'listen')!();
        expect(events.some(event => event.event === 'ready')).toBe(false);
        await hooks.get('nitro:init')!({ hooks: { hook: (name: string, callback: () => void) => nitroHooks.set(name, callback) } });
        nitroHooks.get('dev:start')!();
        nitroHooks.get('dev:reload')!();
        await hooks.get('close')!();
        await expect.poll(() => events.at(-1)?.event).toBe('ready');
    } finally {
        vi.unstubAllEnvs();
        await channel.close();
    }
});
