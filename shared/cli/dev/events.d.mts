/** Application owners understood by the development footer; shared denotes the Turbo build. */
export type DevApp = 'shared' | 'dashboard' | 'api' | 'docs' | 'webshop' | 'renderer' | 'stats';
/** Finite build cycles and process startup/termination, independent of ordinary logs. */
export type DevEventName = 'build.started' | 'build.succeeded' | 'build.failed' | 'starting' | 'ready' | 'stopped';
/** Version-one wire envelope. Sequence is local to an emitter; cycle IDs are monotonic timestamps. */
export type DevEvent = {
    version: 1;
    app: DevApp;
    event: DevEventName;
    session: string;
    processId: string;
    /** Monotonic local process birth time, shared with a supervised child. */
    generation: string;
    /** Monotonic event time orders supervisor and child events sharing a process identity. */
    time: string;
    sequence: number;
    cycleId?: string;
    errors?: number;
    failed?: boolean;
    traceparent?: string;
};
/** Maximum UTF-8 frame size; emitters bound queued output to four frames. */
export const maxEventBytes: number;
/** Narrows untrusted decoded JSON; session membership is checked separately by the receiver. */
export function isDevEvent(value: unknown): value is DevEvent;
/**
 * Creates an ordered, best-effort lifecycle emitter without initializing OpenTelemetry.
 * @param app - Owner displayed by the CLI.
 * @param env - Session socket, identity and trace context; defaults to process.env.
 * @returns An emitter owning at most one socket. Call close before normal process exit.
 * @remarks Missing configuration is a no-op. Connection failure or queue overflow
 * permanently disables this emitter; application startup never waits for delivery.
 * Supervised children share process identity/generation, but have their own sequence.
 */
export function createDevEmitter(app: DevApp, env?: NodeJS.ProcessEnv): {
    /** Queues one bounded frame. Build events must include a monotonic cycleId. */
    emit(event: DevEventName, fields?: Pick<DevEvent, 'cycleId' | 'errors' | 'failed'>): void;
    /** Stops emission and drains the socket for at most 250ms; safe to call after failure. */
    close(): Promise<void>;
};
