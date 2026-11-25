import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import nock from 'nock';
import { expect, it, vi } from 'vitest';

async function freePort() {
    const socket = createServer().listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const addr = socket.address();
    if (!addr || typeof addr === 'string') throw new Error('Expected TCP listener');
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    return addr.port;
}

it
    .skipIf(!process.env.STAM_BACKEND_METRICS_SMOKE)
    .each(['api', 'backup', 'renderer', 'redirecter'])(
    'scrapes the compiled %s entry',
    async (service) => {
        const dir = await mkdtemp(path.join(tmpdir(), 'stam-http-smoke-'));
        const [app, metrics] = await Promise.all([freePort(), freePort()]);
        await writeFile(
            path.join(dir, '.env.json'),
            JSON.stringify({
                ...STAMHOOFD,
                environment: service === 'backup' ? 'development' : 'test',
                PORT: app,
                CACHE_PATH: path.join(dir, 'cache'),
                HEALTH_ACCESS_KEY: 'smoke',
                localBackupFolder: 'invalid-before-any-io',
                DB_PORT: process.env.DB_PORT,
            }),
        );
        const entry = path.resolve(import.meta.dirname, '../../..', service, 'dist/index.js');
        const child = spawn(process.execPath, [entry], {
            cwd: dir,
            env: {
                ...process.env,
                NODE_ENV: 'development',
                STAMHOOFD_ENV: '',
                STAM_METRICS_PORT: String(metrics),
                OTEL_SERVICE_NAME: '',
                OTEL_EXPORTER_OTLP_ENDPOINT: '',
                OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: '',
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const exited = once(child, 'close');
        let errors = '';
        let output = '';
        child.stdout.on('data', (chunk) => (output += chunk.toString()));
        child.stderr.on('data', (chunk) => (errors += chunk.toString()));
        nock.enableNetConnect('127.0.0.1');
        try {
            const scrape = async () => (await fetch(`http://127.0.0.1:${metrics}/metrics`)).text();
            await Promise.race([
                vi.waitFor(
                    async () =>
                        expect(await scrape()).toContain(
                            `stamhoofd_http_requests_in_flight{service_name="${service}"} 0`,
                        ),
                    { timeout: 20000 },
                ),
                exited.then(() => {
                    throw new Error(`Entry stopped: ${errors}`);
                }),
            ]);
            const response = await fetch(
                `http://127.0.0.1:${app}/private-smoke?key=canary-health-key`,
                {
                    redirect: 'manual',
                    headers: { cookie: 'canary-member-cookie' },
                },
            );
            await response.text();
            const text = await scrape();
            expect(text).toMatch(/stamhoofd_http_request_duration_milliseconds_count\{.*\} 1/);
            expect(text).toContain(`status_class="${Math.floor(response.status / 100)}xx"`);
            expect(text).not.toContain('private-smoke');
            const expected: Record<string, string[]> = {
                api: [
                    'in_process',
                    'throttled_batch',
                    'cron_dispatch',
                    'invoice_create',
                    'settlement_reconciliation',
                    'ses_message',
                ],
                renderer: ['in_process'],
                backup: ['backup_full'],
            };
            if (expected[service]) {
                await expect
                    .poll(async () => {
                        const gauges = (await scrape())
                            .split('\n')
                            .filter((line) => line.startsWith('stamhoofd_worker_running{'));
                        return expected[service].filter(
                            (worker) => !gauges.some((line) => line.includes(`worker="${worker}"`)),
                        );
                    })
                    .toEqual([]);
            } else {
                expect(text).not.toMatch(/worker="(?:backup_full|stats_cycle|ses_message)"/);
            }
            const failures = (samples: string, worker: string) =>
                samples
                    .split('\n')
                    .find(
                        (line) =>
                            line.startsWith('stamhoofd_worker_outcomes_total{') &&
                            line.includes(`worker="${worker}"`) &&
                            line.includes('outcome="error"'),
                    );
            if (service === 'api') {
                // Cron reporters register after runApplication initializes the meter.
                expect(failures(await scrape(), 'invoice_create')?.endsWith('} 0')).toBe(true);
            }
            if (service === 'backup') {
                // The backup worker module loads before its entry initializes the meter.
                expect(failures(text, 'backup_full')?.endsWith('} 0')).toBe(true);
                const scheduled = await fetch(`http://127.0.0.1:${app}/v1/backup?key=smoke`, {
                    method: 'POST',
                });
                expect(scheduled.status).toBe(201);
                const after = await scrape();
                expect(failures(after, 'backup_full')?.endsWith('} 1')).toBe(true);
                expect(after).not.toContain('invalid-before-any-io');
            }
        } finally {
            nock.disableNetConnect();
            child.kill('SIGKILL');
            await exited;
            await rm(dir, { recursive: true, force: true });
            expect(output + errors).not.toMatch(
                /private-smoke|canary-health-key|canary-member-cookie|invalid-before-any-io/,
            );
        }
    },
    30000,
);
