import { channel } from 'node:diagnostics_channel';
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
const app = process.env.STAM_DEV_APP as DevApp | undefined;
if (app && process.env.STAM_DEV_SOCKET) {
    const emitter = createDevEmitter(app);
    channel('stamhoofd.application.lifecycle').subscribe((message) => {
        if (!message || typeof message !== 'object') return;
        const event = message as { service?: unknown; event?: unknown };
        if (event.service !== app) return;
        // Subscribers must never throw: diagnostics_channel forwards failures as uncaught errors.
        try {
            if (event.event === 'ready') emitter.emit('ready');
            if (event.event === 'failed') emitter.emit('stopped', { failed: true });
            if (event.event === 'stopped' || event.event === 'failed') void emitter.close().catch(() => {});
        } catch { /* Status reporting must not affect application execution. */ }
    });
}
