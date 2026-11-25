import { initializeMetrics } from '@node/observability';
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
    const metrics = initializeMetrics('stats');
    const scrape = async () => (await fetch(`http://127.0.0.1:${address.port}/metrics`)).text();
    async function tick() {
        await runCronJobs(statisticsCronOptions);
        await waitForCrons();
    }
    try {
        vi.spyOn(getStatisticsConnection(), 'select').mockRejectedValueOnce(
            new Error('private failure'),
        );
        await tick();
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
        await tick();
        await tick();
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
        await metrics?.shutdown();
    }
}, 20000);
