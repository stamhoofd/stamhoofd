import { subscribeDevSpans, type DevSpan } from '@node/dev-tools/spans';
import net from 'node:net';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createDevEmitter, maxEventBytes } from '@node/dev-tools/events';
import type { DevEvent } from '@node/dev-tools/events';
import { openDevEventChannel } from './dev-event-channel.js';

it('delivers ordered events from concurrent producers and removes the socket', async () => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel((event) => events.push(event), 'parent');
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
            expect(
                events
                    .filter((event) => event.app === app)
                    .map((event) => [event.event, event.sequence, event.traceparent]),
            ).toEqual([
                ['starting', 1, 'parent'],
                ['ready', 2, 'parent'],
            ]);
        }
    } finally {
        await channel.close();
    }
    await expect(fs.stat(channel.env.STAM_DEV_SOCKET)).rejects.toThrow();
});

it('accepts fragmented frames and rejects oversized and foreign-session frames', async () => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel((event) => events.push(event));
    try {
        const event = {
            version: 1,
            app: 'api',
            event: 'ready',
            processId: 'p',
            generation: '1',
            time: '1',
            sequence: 1,
            session: channel.env.STAM_DEV_SESSION,
        };
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

it('keeps bounded out-of-order partial trees for a slow subscriber, and clears them on session close', async () => {
    const channel = await openDevEventChannel(() => {}, undefined, 'PATCH /invoices');
    const subscriber = subscribeDevSpans(channel.env.STAM_DEV_SESSION);
    const detached = subscribeDevSpans(channel.env.STAM_DEV_SESSION);
    detached.close();
    const stream = net.createConnection(channel.env.STAM_DEV_SOCKET);
    await once(stream, 'connect');
    const frame = (span: DevSpan) =>
        JSON.stringify({ session: channel.env.STAM_DEV_SESSION, version: 1, span }) + '\n';
    const span: DevSpan = {
        service: 'api',
        name: 'http.server.request',
        kind: 1,
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
        startMs: 1,
        durationMs: 1,
        code: 0,
    };
    try {
        for (let i = 1; i <= 8; i++)
            stream.write(frame({ ...span, traceId: i.toString(16).padStart(32, '0') }));
        for (let i = 1; i <= 140; i++)
            stream.write(
                frame({ ...span, spanId: i.toString(16).padStart(16, '0'), parentId: span.spanId }),
            );
        stream.end(frame(span));
        await once(stream, 'close');
        const snapshot = subscriber.snapshot();
        expect(snapshot).toHaveLength(8);
        expect(snapshot.at(-1)).toHaveLength(128);
        expect(detached.snapshot()).toEqual([]);
    } finally {
        await channel.close();
    }
    expect(subscriber.snapshot()).toEqual([]);
});

it('does not admit span frames on the ordinary lifecycle socket', async () => {
    const channel = await openDevEventChannel(() => {}, undefined, '');
    const subscriber = subscribeDevSpans(channel.env.STAM_DEV_SESSION);
    const emitter = createDevEmitter('api', channel.env);
    try {
        emitter.span({
            service: 'api',
            name: 'http.server.request',
            kind: 1,
            traceId: 'a'.repeat(32),
            spanId: 'b'.repeat(16),
            startMs: 1,
            durationMs: 1,
            code: 0,
        });
        await emitter.close();
        expect(subscriber.snapshot()).toEqual([]);
    } finally {
        await channel.close();
    }
});

it('releases idle and partial connections while an established lifecycle writer remains usable', async () => {
    const events: DevEvent[] = [];
    const channel = await openDevEventChannel((e) => events.push(e));
    const emitter = createDevEmitter('api', channel.env);
    try {
        emitter.emit('starting');
        await expect.poll(() => events.length).toBe(1);
        const idle = Array.from({ length: 63 }, () =>
            net.createConnection(channel.env.STAM_DEV_SOCKET),
        );
        const released = Promise.all(idle.map((s) => once(s, 'close')));
        await Promise.all(idle.map((s) => once(s, 'connect')));
        idle[0].write('{');
        const overflow = net.createConnection(channel.env.STAM_DEV_SOCKET);
        const closed = new Promise<void>((resolve) => overflow.once('close', () => resolve()));
        overflow.on('error', () => {});
        overflow.end(JSON.stringify({ ...events[0], event: 'stopped', sequence: 99 }) + '\n');
        await closed;
        emitter.emit('ready');
        await expect.poll(() => events.length).toBe(2);
        expect(events.map((e) => e.event)).toEqual(['starting', 'ready']);
        await released;
    } finally {
        await emitter.close();
        await channel.close();
    }
});
