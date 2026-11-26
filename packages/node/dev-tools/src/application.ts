import { channel } from 'node:diagnostics_channel';
import { isDevSpan } from './spans.js';
import { createDevEmitter } from './events.js';
import type { DevApp } from './events.js';

/**
 * Node preload injected by supervise.ts through NODE_OPTIONS.
 * @remarks With STAM_DEV_APP and STAM_DEV_SOCKET, subscribes to
 * `stamhoofd.application.lifecycle` for matching service names. Ready is forwarded;
 * failed emits a failed stopped event. Stopped/failed drain the emitter; the
 * supervisor reports the actual process exit. Shares the supervisor's identity
 * via STAM_DEV_* and never throws from the subscriber. No cwd assumptions.
 */
export function attachApplication(app: DevApp) {
    const emitter = createDevEmitter(app);
    const spans = channel('stamhoofd.dev.span.finished');
    const spanEmitter = createDevEmitter(app); // A span backlog must not disconnect lifecycle reporting.
    const send = (value: unknown) => {
        if (isDevSpan(value) && value.service === app && spanEmitter.span(value)) {
            const queued = Symbol.for('stamhoofd.dev.span.queued');
            if (queued in value) Reflect.set(value, queued, true);
        }
    };
    if (process.env.STAM_DEV_CAPTURE && process.env.STAM_DEV_SESSION && (app === 'api' || app === 'renderer' || app === 'stats')) spans.subscribe(send);
    const lifecycle = channel('stamhoofd.application.lifecycle');
    const receive = (message: unknown) => {
        if (!message || typeof message !== 'object') return;
        const event = message as { service?: unknown; event?: unknown };
        if (event.service !== app) return;
        // Subscribers must never throw: diagnostics_channel forwards failures as uncaught errors.
        try {
            if (event.event === 'ready') emitter.emit('ready');
            if (event.event === 'failed') emitter.emit('stopped', { failed: true });
            if (event.event === 'stopped' || event.event === 'failed') {
                void close().catch(() => {});
            }
        } catch { /* Status reporting must not affect application execution. */ }
    };
    lifecycle.subscribe(receive);
    function close() {
        spans.unsubscribe(send);
        lifecycle.unsubscribe(receive);
        return Promise.all([emitter.close(), spanEmitter.close()]);
    }
    return close;
}
const app = process.env.STAM_DEV_APP as DevApp | undefined;
if (app && process.env.STAM_DEV_SOCKET) attachApplication(app);
