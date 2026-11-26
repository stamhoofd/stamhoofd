import { attachApplication } from '@node/dev-tools/application';
import { openDevEventChannel } from '@node/dev-tools/channel';
import { subscribeDevSpans } from '@node/dev-tools/spans';
import { initializeTelemetry, initializeMetrics, traceEndpoint } from '@node/observability';
import { runCronJobs, waitForCrons } from '@stamhoofd/crons';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { statisticsCronOptions } from './crons.js';
import { getStatisticsConnection } from './database.js';

it('distinguishes failed, completed and gated statistics cycles at the scheduler and stage boundaries', async () => {
    const port = createServer().listen(0, '127.0.0.1');
    await once(port, 'listening');
    const address = port.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    await new Promise<void>((resolve) => port.close(() => resolve()));
    vi.stubEnv('STAM_METRICS_PORT', String(address.port));
    const session = await openDevEventChannel(() => {}, undefined, 'statistics.cycle');
    for (const [key, value] of Object.entries(session.env)) vi.stubEnv(key, value);
    vi.stubEnv('STAM_DEV_APP', 'stats');
    const subscriber = subscribeDevSpans(session.env.STAM_DEV_SESSION);
    const detach = attachApplication('stats');
    const telemetry = initializeTelemetry('stats', { ownsMetrics: false });
    const metrics = initializeMetrics('stats');
    const scrape = async () => (await fetch(`http://127.0.0.1:${address.port}/metrics`)).text();
    async function tick() {
        await runCronJobs(statisticsCronOptions);
        await waitForCrons();
    }
    try {
        vi.spyOn(getStatisticsConnection().pool, 'getConnection').mockRejectedValueOnce(
            new Error('private failure'),
        );
        await tick();
        await expect
            .poll(() =>
                subscriber
                    .snapshot()
                    .flat()
                    .some((s) => !s.parentId),
            )
            .toBe(true);
        const [spans] = subscriber.snapshot();
        const root = spans.find((s) => s.name === 'statistics.cycle')!;
        const stage = spans.find((s) => s.name === 'statistics.incremental')!;
        expect(root.code).toBe(2);
        expect(stage.parentId).toBe(root.spanId);
        expect(stage.reason).toBe('execution');
        expect(spans.find((s) => s.name === 'mysql.acquire')).toMatchObject({
            parentId: stage.spanId,
            code: 2,
            reason: 'pool',
        });
        expect(spans.some((s) => s.name === 'mysql.execute')).toBe(false);
        const failed = (await scrape())
            .split('\n')
            .filter((l) => l.startsWith('stamhoofd_worker_outcomes_total{') && !l.endsWith('} 0'));
        for (const worker of ['cron_dispatch', 'stats_cycle', 'stats_incremental']) {
            expect(failed.find((l) => l.includes(`worker="${worker}"`))).toContain(
                'outcome="error"',
            );
        }
        expect(failed.some((l) => l.includes('stats_deletes') || l.includes('stats_settle'))).toBe(
            false,
        );
        await traceEndpoint({}, 'GET', async () => ({ status: 200 }));
        await tick();
        await tick();
        await detach();
        const trees = subscriber.snapshot();
        expect(trees.map((tree) => tree.find((s) => !s.parentId)?.name)).toEqual([
            'statistics.cycle',
            'statistics.cycle',
        ]);
        expect(trees[1][0].traceId).not.toBe(root.traceId);
        expect(trees[1].some((s) => s.name === 'statistics.settle' && s.kind === 0)).toBe(true);
        const text = await scrape();
        expect(text).not.toContain('private failure');
        const counts = text
            .split('\n')
            .filter((l) => l.startsWith('stamhoofd_worker_outcomes_total{'));
        for (const worker of [
            'stats_cycle',
            'stats_incremental',
            'stats_deletes',
            'stats_settle',
        ]) {
            expect(
                counts
                    .find(
                        (l) => l.includes(`worker="${worker}"`) && l.includes('outcome="success"'),
                    )
                    ?.endsWith('} 1'),
            ).toBe(true);
        }
        expect(
            counts
                .find((l) => l.includes('worker="stats_cycle"') && l.includes('outcome="skipped"'))
                ?.endsWith('} 1'),
        ).toBe(true);
    } finally {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        await detach();
        await session.close();
        await telemetry.shutdown();
        await metrics?.shutdown();
    }
}, 20000);
