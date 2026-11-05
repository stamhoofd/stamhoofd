import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import type { DevEvent } from '../../dev/events.mjs';

type Operation = { generation: bigint; processId: string; time: bigint; cycle?: bigint; phase: string; span?: Span };

/**
 * Owns finite build/startup spans and filters late lifecycle events across processes.
 * @remarks Captures the constructing context as a fallback parent. Build and app
 * identities are independent; generations and cycle IDs are monotonic local times.
 * Call close during session teardown to end every outstanding span without ERROR.
 */
export class DevLifecycle {
    private readonly operations = new Map<string, Operation>();
    private readonly parent = context.active();
    private closed = false;

    /** @param changed - Receives accepted transitions synchronously; must not throw. */
    constructor(private readonly changed: (event: DevEvent) => void) {}

    /** Consumes a validated session event; duplicates and superseded operations are ignored. */
    receive(event: DevEvent): void {
        if (this.closed) return;
        const build = event.event.startsWith('build.');
        const key = `${event.app}:${build ? 'build' : 'app'}`;
        const generation = BigInt(event.generation);
        let operation = this.operations.get(key);
        if (operation && (generation < operation.generation || (generation === operation.generation && event.processId !== operation.processId))) return;
        if (!operation || generation > operation.generation) {
            this.end(operation, 'superseded');
            operation = { generation, processId: event.processId, time: -1n, phase: '' };
            this.operations.set(key, operation);
        }
        const time = BigInt(event.time);
        if (time <= operation.time) return;
        if (build) {
            if (!event.cycleId || !/^\d{1,30}$/.test(event.cycleId)) return;
            const cycle = BigInt(event.cycleId);
            if (operation.cycle !== undefined && cycle < operation.cycle) return;
            if (operation.cycle !== cycle) {
                if (event.event !== 'build.started') return;
                this.end(operation, 'superseded');
                operation.cycle = cycle;
                operation.phase = '';
            }
            if (operation.phase === event.event || operation.phase === 'build.succeeded' || operation.phase === 'build.failed') return;
        } else {
            if (operation.phase === 'stopped' || operation.phase === event.event) return;
        }
        operation.time = time;
        operation.phase = event.event;
        if (event.event === 'build.started' || event.event === 'starting') {
            const parent = propagation.extract(this.parent, { traceparent: event.traceparent });
            operation.span = trace.getTracer('stam.dev').startSpan(`dev.${build ? 'build' : 'startup'}`, {
                attributes: {
                    'operation.label': `[${event.app}] ${build ? 'Build' : 'Startup'}`,
                    'dev.app': event.app, 'dev.process.id': event.processId,
                    ...(event.cycleId ? { 'dev.build.cycle': event.cycleId } : {}),
                },
            }, parent);
        } else {
            if (event.errors !== undefined) operation.span?.setAttribute('dev.build.errors', event.errors);
            this.end(operation, event.event, event.event === 'build.failed' || event.failed === true);
        }
        this.changed(event);
    }

    /** Cancels open spans, releases state and ignores future events. Idempotent. */
    close(): void {
        this.closed = true;
        for (const operation of this.operations.values()) this.end(operation, 'cancelled');
        this.operations.clear();
    }

    private end(operation: Operation | undefined, outcome: string, failed = false): void {
        if (!operation?.span) return;
        operation.span.setAttribute('dev.outcome', outcome);
        if (failed) operation.span.setStatus({ code: SpanStatusCode.ERROR });
        operation.span.end();
        operation.span = undefined;
    }
}
