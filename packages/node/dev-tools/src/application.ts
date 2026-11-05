import { channel } from 'node:diagnostics_channel';
import { createDevEmitter } from './events.js';
import type { DevApp } from './events.js';

/** Loaded by the supervisor, keeping development transport out of application dependencies. */
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
