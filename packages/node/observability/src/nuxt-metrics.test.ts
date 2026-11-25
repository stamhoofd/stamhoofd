import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

async function freePort() {
    const socket = createServer().listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    return address.port;
}

it.skipIf(!process.env.STAM_NUXT_METRICS_SMOKE).each(['dev', 'production'])(
    'observes the idle Nitro %s worker before serving one request',
    async (mode) => {
        const docs = path.resolve(import.meta.dirname, '../../../../docs');
        const cwd = await mkdtemp(path.join(docs, '.metrics-smoke-'));
        const nuxt = path.join(docs, 'node_modules/nuxt/bin/nuxt.mjs');
        const [port, metrics] = await Promise.all([freePort(), freePort()]);
        const env = {
            ...process.env,
            NODE_ENV: mode === 'dev' ? 'development' : 'production',
            NUXT_TELEMETRY_DISABLED: '1',
            PORT: String(port),
            HOST: '127.0.0.1',
            OTEL_SERVICE_NAME: 'docs',
            STAM_METRICS_PORT: String(metrics),
        };
        try {
            await writeFile(
                path.join(cwd, 'nuxt.config.ts'),
                `export default defineNuxtConfig({ modules: ['@node/nuxt-observability'], devtools: { enabled: false }, compatibilityDate: '2024-04-03' });`,
            );
            await mkdir(path.join(cwd, 'server/routes'), { recursive: true });
            await writeFile(
                path.join(cwd, 'server/routes/probe.patch.ts'),
                `export default defineEventHandler(() => 'ok');`,
            );
            if (mode === 'production')
                await promisify(execFile)(process.execPath, [nuxt, 'build'], { cwd, env });
            const child = spawn(
                process.execPath,
                mode === 'dev'
                    ? [nuxt, 'dev', '--no-fork', '--port', String(port)]
                    : ['.output/server/index.mjs'],
                { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] },
            );
            const closed = once(child, 'close');
            let output = '';
            child.stdout.on('data', (chunk) => (output += chunk.toString()));
            child.stderr.on('data', (chunk) => (output += chunk.toString()));
            const scrape = async () => (await fetch(`http://127.0.0.1:${metrics}/metrics`)).text();
            try {
                await Promise.race([
                    expect
                        .poll(scrape, { timeout: 30000 })
                        .toContain('stamhoofd_http_requests_in_flight{service_name="docs"} 0'),
                    closed.then(() => {
                        throw new Error(output);
                    }),
                ]);
                const response = await fetch(`http://127.0.0.1:${port}/probe`, { method: 'PATCH' });
                expect(await response.text()).toBe('ok');
                const text = await scrape();
                const count = text
                    .split('\n')
                    .find(
                        (line) =>
                            line.startsWith(
                                'stamhoofd_http_request_duration_milliseconds_count{',
                            ) && line.includes('method="PATCH"'),
                    );
                expect(count).toContain('status_class="2xx"');
                expect(count?.endsWith('} 1')).toBe(true);
                expect(text).toContain('stamhoofd_http_requests_in_flight{service_name="docs"} 0');
            } finally {
                child.kill('SIGKILL');
                await closed;
            }
        } finally {
            await rm(cwd, { recursive: true, force: true });
        }
    },
    90000,
);
