import { afterEach, expect, it, vi } from 'vitest';
import net from 'node:net';
import { createTestEmitter, emptyTestCounts, formatTestCounts, openTestEventChannel } from './test-events.js';
import type { TestProgress } from './test-events.js';
import VitestProgressReporter from './vitest-progress-reporter.js';

afterEach(() => vi.unstubAllEnvs());

it.each(['malformed', 'foreign', 'negative', 'oversized'])('disconnects %s frames without affecting the next reporter', async (kind) => {
    const events: TestProgress[] = [];
    const channel = await openTestEventChannel(event => events.push(event));
    try {
        const event = { ...emptyTestCounts(), completed: 0, finished: true, version: 1, session: channel.env.STAM_TEST_SESSION, sequence: 1 };
        const frame = kind === 'malformed' ? 'not json' : kind === 'oversized' ? 'x'.repeat(5000) : JSON.stringify({ ...event, ...(kind === 'foreign' ? { session: 'foreign' } : { completed: -1 }) });
        await new Promise<void>((resolve) => {
            const socket = net.createConnection(channel.env.STAM_TEST_SOCKET, () => socket.end(frame + '\n'));
            socket.on('error', () => socket.destroy());
            socket.on('close', () => resolve());
        });
        expect(events).toEqual([]);
        const emitter = createTestEmitter(channel.env);
        emitter.emit({ ...emptyTestCounts(), completed: 0, total: 0, finished: true });
        await emitter.close();
        expect(events).toHaveLength(1);
    } finally {
        await channel.close();
    }
});

it('formats only known counters even when a wire event includes protocol fields', () => {
    expect(formatTestCounts({ ...emptyTestCounts(), passed: 3, skipped: 1, completed: 4, total: 4, finished: true } as TestProgress))
        .toBe('3 passed · 1 skipped');
});

it('delivers final snapshots even when intermediate events are throttled', async () => {
    const events: TestProgress[] = [];
    const channel = await openTestEventChannel(event => events.push(event));
    const emitter = createTestEmitter(channel.env);
    try {
        emitter.emit({ ...emptyTestCounts(), completed: 0, finished: false });
        emitter.emit({ ...emptyTestCounts(), completed: 1, passed: 1, finished: false });
        emitter.emit({ ...emptyTestCounts(), completed: 2, total: 2, passed: 2, finished: true });
        await emitter.close();
        expect(events).toHaveLength(2);
        expect(events[1]).toMatchObject({ passed: 2, completed: 2, total: 2, finished: true });
    } finally {
        await emitter.close();
        await channel.close();
    }
});

it('is harmless without a receiver and when the receiver has already closed', async () => {
    const channel = await openTestEventChannel(() => {});
    await channel.close();
    for (const env of [{}, channel.env]) {
        const emitter = createTestEmitter(env);
        emitter.emit({ ...emptyTestCounts(), completed: 0, finished: true });
        await expect(emitter.close()).resolves.toBeUndefined();
    }
});

it('uses authoritative Vitest end results including skipped, todo and pending cases', async () => {
    const events: TestProgress[] = [];
    const channel = await openTestEventChannel(event => events.push(event));
    vi.stubEnv('STAM_TEST_SOCKET', channel.env.STAM_TEST_SOCKET);
    vi.stubEnv('STAM_TEST_SESSION', channel.env.STAM_TEST_SESSION);
    const reporter = new VitestProgressReporter();
    const test = (id: string, state: string, mode = 'run') => ({ id, options: { mode }, result: () => ({ state }), diagnostic: () => undefined });
    try {
        reporter.onTestCaseResult(test('retried', 'failed') as never);
        reporter.onTestCaseResult(test('retried', 'passed') as never);
        await reporter.onTestRunEnd([{
            children: { allTests: () => [test('retried', 'passed'), test('skip', 'skipped'), test('todo', 'skipped', 'todo'), test('hook-failure', 'pending')] },
        }] as never);
        expect(events.at(-1)).toMatchObject({ passed: 1, failed: 0, skipped: 1, todo: 1, pending: 1, completed: 3, total: 4, finished: true });
    } finally {
        await channel.close();
    }
});
