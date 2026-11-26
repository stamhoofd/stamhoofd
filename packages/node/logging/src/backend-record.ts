import { sampledResponseIds } from '@node/observability/request-span-ids';
import { fstatSync, writeSync } from 'node:fs';

const services = new Set(['api', 'renderer', 'backup', 'redirecter', 'statistics-syncer']);
const methods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const events = {
    'application.startup.failed': 'error',
    'application.unhandled': 'error',
    'http.response': 'info',
    'database.query.failed': 'error',
    'database.query.slow': 'warn',
    'worker.failed': 'error',
} as const;
let service: string | undefined;
let dedicated = false;

/** Opt-in local descriptor supplied by the supervisor, never inferred from stdout or stderr. */
export function initializeBackendRecords(name: string) {
    service = services.has(name) ? name : undefined;
    dedicated = false;
    if (service && process.env.STAM_BACKEND_LOG_FD === '3') {
        try {
            const file = fstatSync(3);
            dedicated =
                file.isFile() &&
                [1, 2].every((fd) => {
                    const other = fstatSync(fd);
                    return file.dev !== other.dev || file.ino !== other.ino;
                });
        } catch {
            // Missing or invalid descriptor: do not fall back to collecting another stream.
        }
    }
}

/** The optional request is an identity key only. Never serialize caller objects or headers. */
export function backendRecord(
    event: keyof typeof events,
    method?: string,
    status?: number,
    elapsedMs?: number,
    request?: object,
) {
    try {
        if (typeof event !== 'string' || !Object.prototype.hasOwnProperty.call(events, event))
            return;
        const http = event === 'http.response';
        const code =
            http &&
            typeof status === 'number' &&
            Number.isInteger(status) &&
            status >= 100 &&
            status <= 599
                ? status
                : undefined;
        const level = code && code >= 500 ? 'error' : events[event];
        const record = {
            __proto__: null,
            timestamp: new Date().toISOString(),
            service,
            level,
            event,
            method: http && method && methods.has(method) ? method : undefined,
            status: code,
            elapsedMs:
                (http || event === 'database.query.slow') &&
                typeof elapsedMs === 'number' &&
                Number.isFinite(elapsedMs)
                    ? Math.min(86_400_000, Math.max(0, Math.round(elapsedMs)))
                    : undefined,
        };
        const line = JSON.stringify(record) + '\n';
        (level === 'error' ? process.stderr : process.stdout).write(line);
        // Export candidates: errors/warnings only, never routine traffic or debug chatter.
        if (dedicated && level !== 'info') {
            const ids = http && request ? sampledResponseIds(request) : undefined;
            writeSync(3, ids ? JSON.stringify(Object.assign(record, ids)) + '\n' : line);
        }
    } catch {
        // Serialization or sink failure: drop. Never log the input or the exception.
    }
}
