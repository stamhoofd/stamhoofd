import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const exec = promisify(execFile);
const image = process.env.STAM_OBSERVABILITY_IMAGE;

it.skipIf(!image)(
    'exports private runtime telemetry from the docs image and flushes on SIGTERM',
    async () => {
        const requests: { path?: string; authorization?: string; body: string }[] = [];
        const receiver = createServer((req, res) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
                requests.push({
                    path: req.url,
                    authorization: req.headers.authorization,
                    body: Buffer.concat(chunks).toString('utf8'),
                });
                res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
            });
        }).listen(0, '127.0.0.1');
        await once(receiver, 'listening');
        const address = receiver.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        const name = `docs-observability-${randomUUID()}`;
        try {
            await exec('podman', [
                'run',
                '-d',
                '--name',
                name,
                '--network',
                'host',
                '-e',
                'PORT=0',
                '-e',
                'OTEL_SERVICE_NAME=docs-image-test',
                '-e',
                `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:${address.port}`,
                '-e',
                'OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20image-test-token',
                image!,
                'node',
                '--input-type=module',
                '-e',
                `
                import { Server } from 'node:http';
                const listen = Server.prototype.listen;
                Server.prototype.listen = function (...args) {
                    this.once('listening', async () => {
                        const port = this.address().port;
                        for (const path of ['/', '/synthetic-private-path?token=synthetic-private-query']) {
                            const response = await fetch('http://127.0.0.1:' + port + path, {
                                headers: { authorization: 'synthetic-private-header', cookie: 'synthetic-private-cookie' },
                            });
                            console.log('response', response.status);
                            await response.text();
                        }
                        console.log('requests-complete');
                    });
                    return listen.apply(this, args);
                };
                await import('./.output/server/index.mjs');
            `,
            ]);
            await expect
                .poll(async () => (await exec('podman', ['logs', name])).stdout, { timeout: 20000 })
                .toContain('requests-complete');
            const output = (await exec('podman', ['logs', name])).stdout;
            expect(output).toContain('response 200');
            expect(output).toContain('response 404');
            await exec('podman', ['stop', '--time', '10', name]);
            expect(
                (
                    await exec('podman', ['inspect', '--format', '{{.State.ExitCode}}', name])
                ).stdout.trim(),
            ).toBe('0');
            const payload = requests.map((request) => request.body).join('');
            expect(payload).toContain('application.startup');
            expect(payload).toContain('application.ready');
            expect(payload).toContain('application.stopped');
            expect(payload).toContain('http.server.request');
            expect(payload).toContain('docs-image-test');
            expect(payload).not.toContain('synthetic-private');
            expect(payload).not.toContain('image-test-token');
            expect(requests.some((request) => request.path === '/v1/traces')).toBe(true);
            expect(requests.some((request) => request.path === '/v1/logs')).toBe(true);
            for (const request of requests)
                expect(request.authorization).toBe('Bearer image-test-token');
        } finally {
            await exec('podman', ['rm', '-f', name]).catch(() => {});
            await new Promise<void>((resolve) => receiver.close(() => resolve()));
        }
    },
    40000,
);
