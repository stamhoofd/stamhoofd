import { channel } from 'node:diagnostics_channel';
import { initializeTelemetry } from './telemetry.js';
import { traceStage, traceStatisticsCycle } from './backend-traces.js';
import { fromBinary, toJson } from '@bufbuild/protobuf';
import { ExportTraceServiceRequestSchema } from '@buf/opentelemetry_opentelemetry.bufbuild_es/opentelemetry/proto/collector/trace/v1/trace_service_pb.js';
import { createTraceState, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { expect, it, vi } from 'vitest';
import { sanitizedTraceExporter } from './exporters.js';

it('exports one fully decoded bounded failure; rejects malformed and externally parented spans', async () => {
    const bodies: Buffer[] = [];
    const receiver = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            bodies.push(Buffer.concat(chunks));
            res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
        });
    }).listen(0, '127.0.0.1');
    await once(receiver, 'listening');
    const addr = receiver.address();
    if (!addr || typeof addr === 'string') throw Error('Expected loopback port');
    const exporter = sanitizedTraceExporter(
        new OTLPTraceExporter({ url: `http://127.0.0.1:${addr.port}/v1/traces` }),
        'api',
    );
    const ctx = {
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
        traceFlags: 1,
        traceState: createTraceState('tenant=canary-state'),
    };
    const span: ReadableSpan = {
        instrumentationScope: {
            name: '@node/observability',
            version: 'canary-version',
            schemaUrl: 'canary-scope-url',
            ...{ attributes: { member: 'canary-scope' } },
        },
        resource: resourceFromAttributes(
            { 'service.name': 'canary-member', 'host.name': 'canary-host' },
            { schemaUrl: 'canary-resource-url' },
        ),
        name: 'http.server.request',
        kind: SpanKind.SERVER,
        ended: true,
        startTime: [100, 0],
        endTime: [100, 42],
        duration: [0, 42],
        attributes: {
            'http.route': '/members/alice',
            'http.request.method': 'GET',
            'http.response.status_code': 503,
            'url.query': 'health=canary-key',
            'db.statement': 'SELECT canary',
            'http.request.header.authorization': 'canary-bearer',
        },
        events: [
            {
                name: 'exception',
                time: [100, 0],
                attributes: { 'exception.message': 'canary-error' },
            },
        ],
        links: [{ context: ctx, attributes: { payment: 'canary-payment' } }],
        status: { code: SpanStatusCode.ERROR, message: 'canary-status' },
        spanContext: () => ctx,
        droppedAttributesCount: 9,
        droppedEventsCount: 8,
        droppedLinksCount: 7,
    };
    const send = (batch: ReadableSpan[]) =>
        new Promise<number>((resolve) => exporter.export(batch, (result) => resolve(result.code)));
    try {
        expect(await send([span])).toBe(0);
        expect(bodies).toHaveLength(1);
        // A broken projection must not forward the original batch, even if earlier spans were valid.
        expect(
            await send([
                span,
                {
                    ...span,
                    get attributes(): never {
                        throw Error('canary-getter');
                    },
                },
            ]),
        ).toBe(1);
        expect(bodies).toHaveLength(1);
        expect(bodies[0].toString()).not.toContain('canary');
        const decoded = toJson(
            ExportTraceServiceRequestSchema,
            fromBinary(ExportTraceServiceRequestSchema, bodies[0]),
        );
        expect(decoded).toEqual({
            resourceSpans: [
                {
                    resource: {
                        attributes: [{ key: 'service.name', value: { stringValue: 'api' } }],
                    },
                    scopeSpans: [
                        {
                            scope: { name: '@node/observability' },
                            spans: [
                                {
                                    traceId: Buffer.from(ctx.traceId, 'hex').toString('base64'),
                                    spanId: Buffer.from(ctx.spanId, 'hex').toString('base64'),
                                    flags: 257,
                                    kind: 'SPAN_KIND_SERVER',
                                    name: 'http.server.request',
                                    startTimeUnixNano: '100000000000',
                                    endTimeUnixNano: '100000000042',
                                    attributes: [
                                        {
                                            key: 'http.request.method',
                                            value: { stringValue: 'GET' },
                                        },
                                        {
                                            key: 'http.response.status_code',
                                            value: { intValue: '503' },
                                        },
                                    ],
                                    status: { code: 'STATUS_CODE_ERROR' },
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        for (const invalid of [
            { instrumentationScope: { name: 'canary-scope' } },
            { name: 'canary-name' },
            { parentSpanContext: { ...ctx, isRemote: true } },
            { spanContext: () => ({ ...ctx, traceId: '0'.repeat(32) }) },
            { spanContext: () => ({ ...ctx, spanId: 'not-a-span-id' }) },
            { spanContext: () => ({ ...ctx, isRemote: true }) },
            { status: { code: 99 as SpanStatusCode } },
            { startTime: [NaN, 0] as [number, number] },
            {
                spanContext: () => {
                    throw Error('canary-malformed');
                },
            },
        ])
            await send([{ ...span, ...invalid }]);
        expect(bodies).toHaveLength(1);
    } finally {
        await exporter.shutdown();
        await new Promise<void>((resolve) => receiver.close(() => resolve()));
    }
});

it('projects owned job stages and failed pool checkout with exact fields and parent IDs', async () => {
    const bodies: Buffer[] = [];
    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
            bodies.push(Buffer.concat(chunks));
            res.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end();
        });
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw Error('Expected TCP port');
    vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', `http://127.0.0.1:${addr.port}/v1/traces`);
    const runtime = initializeTelemetry('stats', { ownsMetrics: false });
    try {
        await traceStatisticsCycle(async () => {
            for (const name of [
                'statistics.incremental',
                'statistics.deletes',
                'statistics.settle',
            ] as const)
                await traceStage(name, async () => {
                    if (name === 'statistics.incremental')
                        channel('stamhoofd.database.duration').publish({
                            operation: 'acquire',
                            outcome: 'error',
                            duration: 1,
                        });
                });
        });
        await runtime.shutdown();
        const spans = bodies.flatMap((b) =>
            fromBinary(ExportTraceServiceRequestSchema, b).resourceSpans.flatMap((r) =>
                r.scopeSpans.flatMap((s) => s.spans),
            ),
        );
        expect(spans.map((s) => s.name).sort()).toEqual([
            'mysql.acquire',
            'statistics.cycle',
            'statistics.deletes',
            'statistics.incremental',
            'statistics.settle',
        ]);
        const root = spans.find((s) => s.name === 'statistics.cycle')!;
        for (const s of spans) {
            expect(s.traceId).toEqual(root.traceId);
            if (s.name === 'mysql.acquire') {
                expect(s.parentSpanId).toEqual(
                    spans.find((stage) => stage.name === 'statistics.incremental')?.spanId,
                );
                expect(s.attributes.map((a) => [a.key, a.value?.value.value])).toEqual([
                    ['db.operation.name', 'acquire'],
                    ['error.type', 'pool'],
                ]);
            } else {
                expect(s.attributes).toEqual([]);
                expect(s.parentSpanId).toEqual(s === root ? new Uint8Array() : root.spanId);
            }
        }
    } finally {
        vi.unstubAllEnvs();
        await runtime.shutdown();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
