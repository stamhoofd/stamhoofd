import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';

const entry = new URL('../dist/index.js', import.meta.url).href;

function execute(
    endpoint: string,
    initialize = 'await lifecycle.ready(); await lifecycle.close();',
    service = 'docs',
    signals: Record<string, string> = {},
) {
    return spawn(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `
        import { runApplication } from '${entry}';
        await runApplication(${JSON.stringify(service)}, async lifecycle => { ${initialize} });
    `,
        ],
        {
            env: {
                PATH: process.env.PATH,
                OTEL_SERVICE_NAME: 'docs-staging-test',
                OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '',
                OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: '',
                OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer%20synthetic-source-token',
                OTEL_RESOURCE_ATTRIBUTES:
                    'deployment.environment.name=staging,service.version=test,secret=synthetic-secret',
                ...signals,
            },
            stdio: 'pipe',
        },
    );
}

it('exports protobuf traces and correlated lifecycle logs with runtime credentials', async () => {
    const requests: { path: string; authorization?: string; type?: string; body: string }[] = [];
    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            requests.push({
                path: req.url!,
                authorization: req.headers.authorization,
                type: req.headers['content-type'],
                body: Buffer.concat(chunks).toString('utf8'),
            });
            res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
        });
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        const child = execute(`http://127.0.0.1:${address.port}`);
        expect((await once(child, 'close'))[0]).toBe(0);
        expect(requests.map((request) => request.path).sort()).toEqual(['/v1/logs', '/v1/traces']);
        for (const request of requests) {
            expect(request.authorization).toBe('Bearer synthetic-source-token');
            expect(request.type).toBe('application/x-protobuf');
            if (request.path === '/v1/logs') {
                expect(request.body).toContain('docs-staging-test');
                expect(request.body).toContain('staging');
            } else {
                expect(request.body).toContain('docs');
                expect(request.body).not.toContain('docs-staging-test');
            }
            expect(request.body).not.toContain('synthetic-secret');
            expect(request.body).not.toContain('synthetic-source-token');
        }
        expect(requests.find((request) => request.path === '/v1/logs')?.body).toContain(
            'application.ready',
        );
        expect(requests.find((request) => request.path === '/v1/traces')?.body).toContain(
            'application.startup',
        );
    } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

it('preserves successful application work when the receiver is unavailable', async () => {
    const child = execute('http://127.0.0.1:1');
    expect((await once(child, 'close'))[0]).toBe(0);
});

it('requires an explicit backend trace endpoint and keeps the other signals isolated', async () => {
    const paths: string[] = [];
    const receiver = createServer((req, res) => {
        paths.push(req.url!);
        req.resume();
        res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
    }).listen(0, '127.0.0.1');
    await once(receiver, 'listening');
    try {
        const addr = receiver.address();
        if (!addr || typeof addr === 'string') throw new Error('Expected TCP listener');
        const base = `http://127.0.0.1:${addr.port}`;
        for (const [generic, traces, logs, expected] of [
            ['', '', '', ''],
            [base, '', '', ''],
            ['', '', base + '/v1/logs', ''],
            [base, '', base + '/v1/logs', ''],
            [base, base + '/v1/traces', '', '/v1/traces'],
            ['', base + '/v1/traces', base + '/v1/logs', '/v1/traces'],
        ]) {
            paths.length = 0;
            const child = execute(generic, undefined, 'api', {
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: traces,
                OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: logs,
            });
            expect((await once(child, 'close'))[0]).toBe(0);
            expect(paths).toEqual(expected ? [expected] : []);
        }
    } finally {
        await new Promise<void>((resolve) => receiver.close(() => resolve()));
    }
});

it('never falls back to the generic receiver when a backend trace URL is invalid', async () => {
    const paths: string[][] = [[], []];
    const receivers = paths.map((list) =>
        createServer((req, res) => {
            list.push(req.url!);
            req.resume();
            res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
        }).listen(0, '127.0.0.1'),
    );
    await Promise.all(receivers.map((server) => once(server, 'listening')));
    try {
        const [generic, trace] = receivers.map((server) => {
            const addr = server.address();
            if (!addr || typeof addr === 'string') throw Error('Expected TCP listener');
            return `http://127.0.0.1:${addr.port}`;
        });
        for (const endpoint of ['bad-url', `${trace}/v1/traces`]) {
            const child = execute(generic, undefined, 'api', {
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: endpoint,
            });
            expect((await once(child, 'close'))[0]).toBe(0);
            expect(paths).toEqual([[], endpoint === 'bad-url' ? [] : ['/v1/traces']]);
        }
    } finally {
        await Promise.all(
            receivers.map(
                (server) => new Promise<void>((resolve) => server.close(() => resolve())),
            ),
        );
    }
});
