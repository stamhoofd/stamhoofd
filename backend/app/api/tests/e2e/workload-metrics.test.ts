import {
    SQSClient,
    type ReceiveMessageCommand,
    type ReceiveMessageCommandOutput,
} from '@aws-sdk/client-sqs';
import { readFromQueue } from '../../src/crons/amazon-ses.js';
import { initializeMetrics } from '@node/observability';
import { QueueHandler } from '@stamhoofd/queues';
import { once } from 'node:events';
import { createServer } from 'node:net';
import nock from 'nock';
import { ThrottledQueue } from '../../src/helpers/ThrottledQueue.js';

let metrics: ReturnType<typeof initializeMetrics>;
let scrape: () => Promise<string>;
beforeEach(async () => {
    vi.stubEnv('STAM_METRICS_PORT', undefined);
    initializeMetrics('api');
    await QueueHandler.schedule('private-disabled-key', async () => {});
    const port = createServer().listen(0, '127.0.0.1');
    await once(port, 'listening');
    const address = port.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    await new Promise<void>((resolve) => port.close(() => resolve()));
    vi.stubEnv('STAM_METRICS_PORT', String(address.port));
    metrics = initializeMetrics('api');
    scrape = async () => (await fetch(`http://127.0.0.1:${address.port}/metrics`)).text();
    nock.enableNetConnect('127.0.0.1');
});
afterEach(async () => {
    nock.disableNetConnect();
    await metrics?.shutdown();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

const sample = (text: string, name: string, worker: string, outcome?: string) => {
    const line = text
        .split('\n')
        .find(
            (line) =>
                line.startsWith(`stamhoofd_${name}{`) &&
                line.includes(`worker="${worker}"`) &&
                (!outcome || line.includes(`outcome="${outcome}"`)),
        );
    return line ? Number(line.split(' ').at(-1)) : undefined;
};

it('scrapes waiting, running, skipped and failed work without exposing dynamic queue keys', async () => {
    const key = 'change-member/private@example.com';
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    try {
        const idle = await scrape();
        expect(sample(idle, 'queue_pending', 'in_process')).toBe(0);
        expect(sample(idle, 'queue_oldest_pending_milliseconds', 'in_process')).toBe(0);
        expect(idle).not.toContain('stats_incremental');
        expect(sample(idle, 'worker_outcomes_total', 'in_process', 'success')).toBe(0);

        const active = QueueHandler.schedule(key, async ({ abort }) => {
            await gate;
            abort.throwIfAborted();
        });
        const queued = QueueHandler.schedule(key, async () => {});
        const batch = new ThrottledQueue(
            async () => {
                await gate;
                throw new Error('private-failure');
            },
            { maxDelay: null, maxBatchSize: 2 },
        );
        batch.addItem(key);
        batch.addItems([key, 'second', 'third', 'fourth']);
        const waiting = await scrape();
        expect(sample(waiting, 'worker_running', 'in_process')).toBe(1);
        expect(sample(waiting, 'queue_pending', 'in_process')).toBe(1);
        expect(sample(waiting, 'queue_pending', 'throttled_batch')).toBe(2);
        expect(sample(waiting, 'worker_running', 'throttled_batch')).toBe(1);
        const age = sample(waiting, 'queue_oldest_pending_milliseconds', 'in_process')!;
        expect(age).toBeGreaterThan(0);
        expect(
            sample(await scrape(), 'queue_oldest_pending_milliseconds', 'in_process'),
        ).toBeGreaterThan(age);

        QueueHandler.abort(key, new Error('private-abort'));
        release();
        expect((await Promise.allSettled([active, queued])).map((s) => s.status)).toEqual([
            'rejected',
            'rejected',
        ]);
        await QueueHandler.schedule(key, async () => {});
        await expect(
            QueueHandler.schedule(key, async () => {
                QueueHandler.abort(key);
                throw new Error('independent private failure');
            }),
        ).rejects.toThrow('independent private failure');
        await batch.flushAndWait();
        const done = await scrape();
        for (const outcome of ['aborted', 'skipped', 'success', 'error']) {
            expect(sample(done, 'worker_outcomes_total', 'in_process', outcome)).toBe(1);
        }
        expect(
            sample(done, 'worker_duration_milliseconds_count', 'in_process', 'skipped'),
        ).toBeUndefined();
        expect(sample(done, 'worker_duration_milliseconds_count', 'throttled_batch', 'error')).toBe(
            2,
        );
        expect(sample(done, 'queue_oldest_pending_milliseconds', 'in_process')).toBe(0);
        expect(sample(done, 'queue_pending', 'throttled_batch')).toBe(0);
        expect(done).not.toMatch(/private|example\.com/);
    } finally {
        release();
    }
});

it('measures individual SES messages even when processing errors are caught inside the poll', async () => {
    const url = 'https://private-queue.example.com';
    const valid = { bounce: { bouncedRecipients: [] }, mail: {} };
    const client: { send(command: ReceiveMessageCommand): Promise<ReceiveMessageCommandOutput> } =
        SQSClient.prototype;
    const receive = vi.spyOn(client, 'send');
    receive.mockResolvedValueOnce({
        $metadata: {},
        Messages: [
            { Body: JSON.stringify({ Message: JSON.stringify(valid) }) },
            { Body: 'invalid-private-message' },
            { Body: '{}' },
        ],
    });
    expect(await readFromQueue(url)).toBe(3);
    receive.mockResolvedValueOnce({
        $metadata: {},
        Messages: [{ ReceiptHandle: 'private-handle' }],
    });
    receive.mockRejectedValueOnce(new Error('private-delete-error'));
    await expect(readFromQueue(url)).rejects.toThrow('private-delete-error');
    const text = await scrape();
    for (const [outcome, count] of [
        ['success', 1],
        ['error', 2],
        ['skipped', 1],
    ] as const) {
        expect(sample(text, 'worker_outcomes_total', 'ses_message', outcome)).toBe(count);
    }
    expect(text).not.toMatch(/private|example\.com/);
});
