import { once } from 'node:events';
import { createServer, type ServerResponse } from 'node:http';
import { expect, it, vi } from 'vitest';
import { observeHttpServer } from './http-metrics.js';
import { initializeMetrics } from './metrics.js';

it('counts wire completions once, including a streaming client disconnect, without request data', async () => {
    let streaming!: ServerResponse;
    const app = createServer((req, res) => {
        if (req.method === 'POST') {
            streaming = res;
            res.write('streaming');
        } else if (req.method === 'PUT') {
            res.on('error', () => res.end());
            res.emit('error', new Error('private-stream-error'));
        } else {
            const status = req.method === 'HEAD' ? 204 : req.method === 'PROPFIND' ? 503 : 404;
            res.writeHead(status).end();
        }
    });
    vi.stubEnv('STAM_METRICS_PORT', '');
    expect(initializeMetrics('renderer')).toBeUndefined();
    observeHttpServer(app);
    expect(app.listenerCount('request')).toBe(1);

    const reservation = createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const address = reservation.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP port');
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    vi.stubEnv('STAM_METRICS_PORT', String(address.port));
    vi.stubEnv('OTEL_SERVICE_NAME', 'renderer');
    const metrics = initializeMetrics('renderer');
    const scrape = async () => (await fetch(`http://127.0.0.1:${address.port}/metrics`)).text();
    try {
        observeHttpServer(app);
        observeHttpServer(app);
        app.listen(0, '127.0.0.1');
        await once(app, 'listening');
        const listener = app.address();
        if (!listener || typeof listener === 'string') throw new Error('Expected TCP port');
        const url = `http://127.0.0.1:${listener.port}/private-path?token=private-query`;
        const gauge = 'stamhoofd_http_requests_in_flight{service_name="renderer"}';
        expect(await scrape()).toContain(`${gauge} 0`);
        const abort = new AbortController();
        const stream = await fetch(url, { method: 'POST', signal: abort.signal });
        expect(stream.status).toBe(200);
        expect(await scrape()).toContain(`${gauge} 1`);
        const closed = once(streaming, 'close');
        abort.abort();
        await closed;
        for (const method of ['GET', 'HEAD', 'PROPFIND', 'PUT']) {
            await (await fetch(url, { method, headers: { cookie: 'private-cookie' } })).text();
        }
        const text = await scrape();
        expect(text).toContain(`${gauge} 0`);
        const counts = text
            .split('\n')
            .filter((line) =>
                line.startsWith('stamhoofd_http_request_duration_milliseconds_count{'),
            );
        expect(counts).toHaveLength(5);
        for (const [method, status] of [
            ['POST', 'aborted'],
            ['PUT', 'aborted'],
            ['GET', '4xx'],
            ['HEAD', '2xx'],
            ['_OTHER', '5xx'],
        ]) {
            expect(counts.find((line) => line.includes(`method="${method}"`))).toMatch(
                new RegExp(`status_class="${status}".*\\} 1$`),
            );
        }
        const streamed = text
            .split('\n')
            .find(
                (line) =>
                    line.startsWith('stamhoofd_http_request_duration_milliseconds_sum{') &&
                    line.includes('method="POST"'),
            );
        expect(Number(streamed?.split(' ').at(-1))).toBeGreaterThan(0);
        expect(text).not.toMatch(/private-|PROPFIND/);
    } finally {
        app.closeAllConnections();
        await new Promise<void>((resolve) => app.close(() => resolve()));
        await metrics?.shutdown();
        vi.unstubAllEnvs();
    }
});
