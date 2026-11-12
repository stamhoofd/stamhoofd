import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { channel } from 'node:diagnostics_channel';
import { once } from 'node:events';
import { context, logs, SeverityNumber, SpanStatusCode, trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { InMemoryLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ApplicationLifecycle } from './lifecycle.js';
import { sanitizedLogExporter, sanitizedTraceExporter } from './exporters.js';

const spans = new InMemorySpanExporter();
const records = new InMemoryLogRecordExporter();
const spanProcessor = new SimpleSpanProcessor({ exporter: sanitizedTraceExporter(spans) });
const logProcessor = new SimpleLogRecordProcessor({ exporter: sanitizedLogExporter(records) });
const sdk = new NodeSDK({
    autoDetectResources: false,
    spanProcessors: [spanProcessor],
    logRecordProcessors: [logProcessor],
    metricReaders: [],
});
beforeAll(() => sdk.start());
afterAll(async () => {
    await sdk.shutdown();
    trace.disable();
    logs.disable();
    context.disable();
});

it('waits for listening without a development session and emits one completed startup', async () => {
    const server = createServer();
    const events: unknown[] = [];
    const observer = (event: unknown) => {
        events.push(event);
    };
    const bus = channel('stamhoofd.application.lifecycle');
    bus.subscribe(observer);
    const lifecycle = new ApplicationLifecycle('test-listener');
    let ready = false;
    const pending = lifecycle.ready(server).then(() => {
        ready = true;
    });
    try {
        await Promise.resolve();
        expect(ready).toBe(false);
        expect(events).toEqual([{ service: 'test-listener', event: 'starting' }]);
        server.listen(0, '127.0.0.1');
        await pending;
        await lifecycle.ready(server);
        await spanProcessor.forceFlush();
        await logProcessor.forceFlush();
        expect(events).toEqual([
            { service: 'test-listener', event: 'starting' },
            { service: 'test-listener', event: 'ready' },
        ]);
        const startup = spans.getFinishedSpans().at(-1)!;
        expect(startup.name).toBe('application.startup');
        expect(startup.duration).toBeDefined();
        expect(startup.ended).toBe(true);
        expect(records.getFinishedLogRecords().at(-1)?.spanContext?.traceId).toBe(
            startup.spanContext().traceId,
        );
    } finally {
        bus.unsubscribe(observer);
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

it('preserves a listener error and never reports readiness after failure', async () => {
    const server = createServer();
    const lifecycle = new ApplicationLifecycle('failed-listener');
    const error = new Error('synthetic-secret');
    const pending = lifecycle.ready(server);
    server.emit('error', error);
    await expect(pending).rejects.toBe(error);
    await lifecycle.ready();
    await spanProcessor.forceFlush();
    await logProcessor.forceFlush();
    expect(spans.getFinishedSpans().at(-1)?.status.code).toBe(SpanStatusCode.ERROR);
    expect(records.getFinishedLogRecords().at(-1)?.body).toBe('application.startup.failed');
    expect(JSON.stringify(records.getFinishedLogRecords())).not.toContain('synthetic-secret');
});

it('accepts an already-listening server and non-HTTP initialization', async () => {
    const server = createServer().listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        await new ApplicationLifecycle('http').ready(server);
        await new ApplicationLifecycle('stats').ready();
    } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

it('exports only approved fields and fixed messages, retaining real SDK span timing', async () => {
    const tracer = trace.getTracer('@node/observability');
    const span = tracer.startSpan('http.server.request', {
        attributes: {
            'http.request.method': 'GET',
            'http.response.status_code': 503,
            'http.route': '/members/:id',
            'url.full': '/members/123?token=synthetic-secret',
            'http.request.header.cookie': 'synthetic-secret',
            'request.body': '{"name":"synthetic-secret"}',
        },
    });
    span.recordException(new Error('synthetic-secret'));
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'synthetic-secret' });
    span.end();
    tracer.startSpan('synthetic-secret').end();
    logs.getLogger('@node/observability').emit({
        body: 'application.ready',
        eventName: 'synthetic-secret',
        severityText: 'synthetic-secret',
        severityNumber: SeverityNumber.INFO,
        attributes: { authorization: 'synthetic-secret' },
    });
    logs.getLogger('@node/observability').emit({ body: 'synthetic-secret' });
    await spanProcessor.forceFlush();
    await logProcessor.forceFlush();
    const exported = spans.getFinishedSpans().at(-1)!;
    expect(exported.name).toBe('http.server.request');
    expect(exported.attributes).toEqual({
        'http.request.method': 'GET',
        'http.response.status_code': 503,
        'http.route': '/members/:id',
    });
    expect(exported.events).toEqual([]);
    expect(exported.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(JSON.stringify(spans.getFinishedSpans())).not.toContain('synthetic-secret');
    expect(JSON.stringify(records.getFinishedLogRecords())).not.toContain('synthetic-secret');
});
