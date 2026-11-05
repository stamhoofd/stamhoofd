import { expect, it, vi } from 'vitest';
import type { DevEvent } from '../../dev/events.mjs';
import { DevLifecycle } from './dev-lifecycle.js';
import { DevStatus } from './dev-status.js';
import { isPortListening } from './port-probe.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api';

vi.mock('./port-probe.js', () => ({ isPortListening: vi.fn(async () => true) }));
const event = (event: DevEvent['event'], fields: Partial<DevEvent> = {}): DevEvent => ({ version: 1, session: 'session', app: 'api', processId: 'one', generation: '1', time: process.hrtime.bigint().toString(), sequence: 1, event, ...fields });

it('keeps readiness explicit and preserves a running server through failed rebuilds', async () => {
    const status = new DevStatus([{ id: 'api', label: 'api', port: 9091 }], () => {});
    const lifecycle = new DevLifecycle(value => status.event(value));
    lifecycle.receive(event('starting'));
    await status.check();
    expect(status.items()[0].state).toBe('starting');
    lifecycle.receive(event('ready'));
    lifecycle.receive(event('build.started', { cycleId: '1' }));
    lifecycle.receive(event('build.failed', { cycleId: '1', errors: 1 }));
    await status.check();
    expect(status.items()[0].state).toBe('warning');
    lifecycle.receive(event('build.started', { cycleId: '2' }));
    lifecycle.receive(event('build.succeeded', { cycleId: '2' }));
    expect(status.items()[0].state).toBe('running');
    lifecycle.receive(event('stopped', { failed: true }));
    await status.check();
    expect(status.items()[0].state).toBe('failed');
    lifecycle.close();
    status.stop();
});

it('ignores stale processes, terminal-state regressions and old build cycles', () => {
    const changed = vi.fn();
    const lifecycle = new DevLifecycle(changed);
    lifecycle.receive(event('starting', { processId: 'two', generation: '2' }));
    lifecycle.receive(event('ready', { processId: 'two', generation: '2' }));
    changed.mockClear();
    lifecycle.receive(event('stopped'));
    lifecycle.receive(event('starting', { processId: 'two', generation: '2', time: '0' }));
    expect(changed).not.toHaveBeenCalled();
    lifecycle.receive(event('build.started', { cycleId: '2' }));
    lifecycle.receive(event('build.succeeded', { cycleId: '2' }));
    changed.mockClear();
    lifecycle.receive(event('build.failed', { cycleId: '1' }));
    lifecycle.receive(event('build.started', { cycleId: '2' }));
    expect(changed).not.toHaveBeenCalled();
    lifecycle.close();
    lifecycle.receive(event('starting', { generation: '3' }));
    expect(changed).not.toHaveBeenCalled();
});

it('detects listener loss after structured readiness', async () => {
    const status = new DevStatus([{ id: 'api', label: 'api', port: 9091 }], () => {});
    status.event(event('ready'));
    vi.mocked(isPortListening).mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    await status.check();
    await status.check();
    expect(status.items()[0].state).toBe('failed');
    status.stop();
});

it('exports finite spans with explicit parent correlation and distinguishes failure from cancellation', async () => {
    const exporter = new InMemorySpanExporter();
    const sdk = new NodeSDK({ autoDetectResources: false, spanProcessors: [new SimpleSpanProcessor({ exporter })] });
    sdk.start();
    const lifecycle = new DevLifecycle(() => {});
    try {
        lifecycle.receive(event('build.started', { cycleId: '1', traceparent: `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01` }));
        lifecycle.receive(event('build.failed', { cycleId: '1', errors: 1 }));
        lifecycle.receive(event('starting'));
        lifecycle.close();
        const [build, startup] = exporter.getFinishedSpans();
        expect(build.spanContext().traceId).toBe('a'.repeat(32));
        expect(build.parentSpanContext?.spanId).toBe('b'.repeat(16));
        expect(build.status.code).toBe(SpanStatusCode.ERROR);
        expect(build.attributes['dev.build.errors']).toBe(1);
        expect(startup.status.code).not.toBe(SpanStatusCode.ERROR);
        expect(startup.attributes['dev.outcome']).toBe('cancelled');
    } finally {
        lifecycle.close();
        await sdk.shutdown();
        trace.disable();
        context.disable();
        propagation.disable();
    }
});
