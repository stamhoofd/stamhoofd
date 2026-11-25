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
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        const exited = once(child, 'close');
        let errors = '';
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
            const response = await fetch(`http://127.0.0.1:${app}/private-smoke`, {
                redirect: 'manual',
            });
            await response.text();
            const text = await scrape();
            expect(text).toMatch(/stamhoofd_http_request_duration_milliseconds_count\{.*\} 1/);
            expect(text).toContain(`status_class="${Math.floor(response.status / 100)}xx"`);
            expect(text).not.toContain('private-smoke');
        } finally {
            nock.disableNetConnect();
            child.kill('SIGKILL');
            await exited;
            await rm(dir, { recursive: true, force: true });
        }
    },
    30000,
);
