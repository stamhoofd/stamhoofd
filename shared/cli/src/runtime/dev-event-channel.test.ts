import net from 'node:net';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createDevEmitter, maxEventBytes } from '@node/dev-tools/events';
import type { DevEvent } from '@node/dev-tools/events';
import { openDevEventChannel } from './dev-event-channel.js';

it('delivers ordered events from concurrent producers and removes the socket', async () => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel(event => events.push(event), 'parent');
    const api = createDevEmitter('api', channel.env);
    const docs = createDevEmitter('docs', channel.env);
    try {
        api.emit('starting');
        docs.emit('starting');
        api.emit('ready');
        docs.emit('ready');
        await Promise.all([api.close(), docs.close()]);
        await expect.poll(() => events.length).toBe(4);
        for (const app of ['api', 'docs']) {
            expect(events.filter(event => event.app === app).map(event => [event.event, event.sequence, event.traceparent])).toEqual([
                ['starting', 1, 'parent'], ['ready', 2, 'parent'],
            ]);
        }
    } finally {
        await channel.close();
    }
    await expect(fs.stat(channel.env.STAM_DEV_SOCKET)).rejects.toThrow();
});

it('accepts fragmented frames and rejects oversized and foreign-session frames', async () => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel(event => events.push(event));
    try {
        const event = { version: 1, app: 'api', event: 'ready', processId: 'p', generation: '1', time: '1', sequence: 1, session: channel.env.STAM_DEV_SESSION };
        const socket = net.createConnection(channel.env.STAM_DEV_SOCKET);
        await once(socket, 'connect');
        const frame = JSON.stringify(event) + '\n';
        socket.write(frame.slice(0, 20));
        socket.write(frame.slice(20));
        await expect.poll(() => events.length).toBe(1);
        socket.end(JSON.stringify({ ...event, session: 'another-session' }) + '\n');
        await once(socket, 'close');
        const oversized = net.createConnection(channel.env.STAM_DEV_SOCKET);
        await once(oversized, 'connect');
        oversized.write('x'.repeat(maxEventBytes + 1));
        await once(oversized, 'close');
        expect(events).toHaveLength(1);
    } finally {
        await channel.close();
    }
});

it('does not prevent application work without a channel or after disconnection', async () => {
    const disabled = createDevEmitter('api', {});
    disabled.emit('ready');
    await disabled.close();
    const channel = await openDevEventChannel(() => {});
    const emitter = createDevEmitter('api', channel.env);
    await channel.close();
    emitter.emit('ready');
    await emitter.close();
});
