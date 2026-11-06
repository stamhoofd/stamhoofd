import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';

const entry = new URL('../dist/index.js', import.meta.url).href;

function execute(endpoint: string, initialize = 'await lifecycle.ready(); await lifecycle.close();') {
    return spawn(process.execPath, ['--input-type=module', '-e', `
        import { runApplication } from '${entry}';
        await runApplication('docs', async lifecycle => { ${initialize} });
    `], {
        env: {
            ...process.env,
            OTEL_SERVICE_NAME: 'docs-staging-test',
            OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
            OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '',
            OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: '',
            OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer%20synthetic-source-token',
            OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment.name=staging,service.version=test,secret=synthetic-secret',
        },
        stdio: 'pipe',
    });
}

it('exports protobuf traces and correlated lifecycle logs with runtime credentials', async () => {
    const requests: { path: string; authorization?: string; type?: string; body: string }[] = [];
    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            requests.push({ path: req.url!, authorization: req.headers.authorization, type: req.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') });
            res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
        });
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        const child = execute(`http://127.0.0.1:${address.port}`);
        expect((await once(child, 'close'))[0]).toBe(0);
        expect(requests.map(request => request.path).sort()).toEqual(['/v1/logs', '/v1/traces']);
        for (const request of requests) {
            expect(request.authorization).toBe('Bearer synthetic-source-token');
            expect(request.type).toBe('application/x-protobuf');
            expect(request.body).toContain('docs-staging-test');
            expect(request.body).toContain('staging');
            expect(request.body).not.toContain('synthetic-secret');
            expect(request.body).not.toContain('synthetic-source-token');
        }
        expect(requests.find(request => request.path === '/v1/logs')?.body).toContain('application.ready');
        expect(requests.find(request => request.path === '/v1/traces')?.body).toContain('application.startup');
    } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});

it('preserves successful application work when the receiver is unavailable', async () => {
    const child = execute('http://127.0.0.1:1');
    expect((await once(child, 'close'))[0]).toBe(0);
});
