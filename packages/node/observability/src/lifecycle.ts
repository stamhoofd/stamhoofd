import { channel } from 'node:diagnostics_channel';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { context, logs, SeverityNumber, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';

const lifecycleChannel = channel('stamhoofd.application.lifecycle');

/** Waits for the real listener in every environment; listener errors propagate. */
export async function waitForListening(server: Server): Promise<void> {
    if (!server.listening) await once(server, 'listening');
}

/**
 * One application initialization, independent of its observers or environment.
 * Construct before initialization, call ready after it, and failed on rejection.
 * Process signals, application cleanup, and SDK lifetime belong to the caller.
 */
export class ApplicationLifecycle {
    private readonly startup: Span;
    private phase: 'starting' | 'ready' | 'failed' | 'stopped' = 'starting';

    constructor(readonly service: string, private readonly flush?: () => Promise<void>) {
        this.startup = trace.getTracer('@node/observability').startSpan('application.startup');
        this.notify('starting');
    }

    /** Completes initialization only after the optional HTTP listener is available. */
    async ready(server?: Server): Promise<void> {
        if (this.phase !== 'starting') return;
        try {
            if (server) await waitForListening(server);
        } catch (error) {
            this.failed();
            throw error;
        }
        if (this.phase !== 'starting') return;
        this.phase = 'ready';
        this.record('application.ready');
        this.startup.end();
        this.notify('ready');
    }

    /** Records a fixed failure code, never the original error's message or payload. */
    failed(): void {
        if (this.phase !== 'starting') return;
        this.phase = 'failed';
        this.startup.setStatus({ code: SpanStatusCode.ERROR });
        this.record('application.startup.failed');
        this.startup.end();
        this.notify('failed');
    }

    /** Records graceful termination; call after application cleanup, before SDK flush. */
    stopped(): void {
        if (this.phase === 'stopped') return;
        if (this.phase === 'starting') {
            this.startup.setAttribute('application.outcome', 'cancelled');
            this.startup.end();
        }
        this.phase = 'stopped';
        this.record('application.stopped');
        this.notify('stopped');
    }

    /** Flushes only when this lifecycle was given ownership by executable bootstrap. */
    async close(): Promise<void> {
        this.stopped();
        await this.flush?.();
    }

    private record(body: string): void {
        logs.getLogger('@node/observability').emit({
            body,
            severityNumber: this.phase === 'failed' ? SeverityNumber.ERROR : SeverityNumber.INFO,
            context: this.phase === 'stopped' ? context.active() : trace.setSpan(context.active(), this.startup),
        });
    }

    private notify(event: 'starting' | 'ready' | 'failed' | 'stopped'): void {
        lifecycleChannel.publish({ service: this.service, event });
    }
}
