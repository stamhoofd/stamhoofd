import net from 'node:net';
import { randomUUID } from 'node:crypto';

/** Application owners understood by the development footer. */
export type DevApp = 'shared' | 'dashboard' | 'api' | 'docs' | 'webshop' | 'renderer' | 'stats';
export type DevEventName = 'build.started' | 'build.succeeded' | 'build.failed' | 'starting' | 'ready' | 'stopped';
/** Sequence is emitter-local; producer time orders supervisor and child events. */
export type DevEvent = {
    version: 1;
    app: DevApp;
    event: DevEventName;
    session: string;
    processId: string;
    generation: string;
    time: string;
    sequence: number;
    cycleId?: string;
    errors?: number;
    failed?: boolean;
    traceparent?: string;
    startupOwner?: 'application';
};

export const maxEventBytes = 16 * 1024;
const apps = ['shared', 'dashboard', 'api', 'docs', 'webshop', 'renderer', 'stats'];
const events = ['build.started', 'build.succeeded', 'build.failed', 'starting', 'ready', 'stopped'];

/** Validate the wire format before handing it to status/telemetry consumers. */
export function isDevEvent(value: unknown): value is DevEvent {
    if (value === null || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return validateDevEvent(record);
}

function validateDevEvent(value: Record<string, unknown>): boolean {
    return value !== null && typeof value === 'object'
        && value.version === 1 && typeof value.app === 'string' && apps.includes(value.app)
        && typeof value.event === 'string' && events.includes(value.event)
        && typeof value.session === 'string' && typeof value.processId === 'string'
        && typeof value.generation === 'string' && /^\d{1,30}$/.test(value.generation)
        && typeof value.time === 'string' && /^\d{1,30}$/.test(value.time)
        && typeof value.sequence === 'number' && Number.isSafeInteger(value.sequence) && value.sequence > 0
        && (value.event.startsWith('build.') ? typeof value.cycleId === 'string' : value.cycleId === undefined)
        && (value.errors === undefined || (typeof value.errors === 'number' && Number.isSafeInteger(value.errors) && value.errors >= 0))
        && (value.failed === undefined || typeof value.failed === 'boolean')
        && (value.traceparent === undefined || typeof value.traceparent === 'string')
        && (value.startupOwner === undefined || value.startupOwner === 'application');
}

/**
 * Development-only, ordered NDJSON channel. Importable before any shared build.
 * A missing/closed receiver disables delivery without affecting the application.
 * Each emitter owns one bounded connection; close() drains it with a deadline.
 */
export function createDevEmitter(app: DevApp, env: NodeJS.ProcessEnv = process.env) {
    const identity = {
        version: 1, app, session: env.STAM_DEV_SESSION,
        processId: env.STAM_DEV_PROCESS_ID ?? randomUUID(),
        generation: env.STAM_DEV_GENERATION ?? process.hrtime.bigint().toString(),
        traceparent: env.STAM_DEV_TRACEPARENT,
    };
    let sequence = 0;
    let socket: net.Socket | undefined;
    let closed = false;
    return {
        emit(event: DevEventName, fields: Pick<DevEvent, 'cycleId' | 'errors' | 'failed' | 'startupOwner'> = {}) {
            if (closed || !env.STAM_DEV_SOCKET || !env.STAM_DEV_SESSION) return;
            const line = JSON.stringify({ ...fields, ...identity, event, time: process.hrtime.bigint().toString(), sequence: ++sequence }) + '\n';
            if (Buffer.byteLength(line) > maxEventBytes) return;
            if (!socket) {
                socket = net.createConnection(env.STAM_DEV_SOCKET);
                socket.unref();
                socket.on('error', () => { closed = true; socket?.destroy(); });
                socket.on('close', () => { closed = true; });
            }
            if (socket.writableLength + Buffer.byteLength(line) > maxEventBytes * 4) {
                closed = true;
                socket.destroy();
                return;
            }
            socket.write(line);
        },
        async close() {
            closed = true;
            if (!socket || socket.destroyed) return;
            const connection = socket;
            await new Promise<void>((resolve) => {
                const timer = setTimeout(() => connection.destroy(), 250);
                connection.once('close', () => { clearTimeout(timer); resolve(); });
                connection.end();
            });
        },
    };
}
