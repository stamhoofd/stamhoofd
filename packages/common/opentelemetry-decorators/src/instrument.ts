import { context, createContextKey, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Attributes, Span } from '@opentelemetry/api';

const fieldsKey = createContextKey('stamhoofd.telemetry.fields');
const sinkKey = createContextKey('stamhoofd.telemetry.log-sink');
/** Severity passed to a scoped {@link LogSink}. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
/**
 * Synchronously presents a log message and its contextual attributes.
 *
 * @returns Literal `true` only when the entire message was presented. All other
 * returns, including void and Promises, leave delivery unacknowledged.
 * @remarks Asynchronous transports own their buffering and rejection handling.
 * Synchronous sink errors are swallowed by {@link log} and {@link diagnostic}.
 */
export type LogSink = (level: LogLevel, message: string, fields: Attributes) => unknown;

/**
 * A command, subprocess output chunk, or safe failure message for presentation.
 * Output with `always: true` uses info severity; other output and commands use
 * debug severity. Failures use error severity but do not mark the span failed.
 */
export type DiagnosticEvent
    = | { kind: 'command'; message: string }
        | { kind: 'output'; stream: 'stdout' | 'stderr'; message: string; always?: boolean }
        | { kind: 'failure'; message: string };

/**
 * Presents a diagnostic with a {@link diagnosticKind} attribute.
 *
 * @param event - Explicitly selected, safe diagnostic text.
 * @param sink - Defaults to {@link log}, which adds inherited fields and active
 * trace IDs. A custom sink receives only the diagnostic-kind attribute.
 * @returns Whether the sink acknowledged the entire message; false if it throws.
 */
export function diagnostic(event: DiagnosticEvent, sink: LogSink = log): boolean {
    const level = event.kind === 'failure' ? 'error' : event.kind === 'output' && event.always ? 'info' : 'debug';
    try {
        return sink(level, event.message, { [diagnosticKind]: event.kind === 'output' ? event.stream : event.kind }) === true;
    } catch {
        return false;
    }
}

/** Span attribute containing the operation's human-readable presentation label. */
export const operationLabel = 'operation.label';
/** Log attribute identifying command, stdout, stderr, or failure diagnostics. */
export const diagnosticKind = 'diagnostic.kind';

/**
 * Marks the active span failed without ending it or recording an exception.
 * Use for non-throwing failures, such as a subprocess returning a nonzero exit
 * code. Does nothing without an active span; status-update errors are ignored.
 */
export function markSpanFailed(): void {
    try {
        trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
    } catch { /* Telemetry must not change application results. */ }
}

/**
 * Executes a callback with a scoped logging destination.
 *
 * @param sink - Destination used by {@link log} and, by default, {@link diagnostic}.
 * @param callback - Work to execute immediately; nested scopes may override the sink.
 * @returns The callback's result, without converting synchronous results to Promises.
 * @remarks Callback errors propagate unchanged. Inheritance across awaits requires
 * a working asynchronous OpenTelemetry context manager. The sink is not disposed
 * or flushed when the callback finishes.
 */
export function withLogSink<T>(sink: LogSink, callback: () => T): T {
    return context.with(context.active().setValue(sinkKey, sink), callback);
}

/** Returns whether the active context has a sink, regardless of delivery success. */
export function hasLogSink(): boolean {
    return context.active().getValue(sinkKey) !== undefined;
}

/**
 * Presents a message to the active scoped sink, without adding a span event.
 *
 * @param level - Message severity.
 * @param message - Explicitly selected, safe text to present.
 * @param fields - Attributes overriding inherited operation fields. Valid active
 * `trace_id` and `span_id` values take precedence over supplied attributes.
 * @returns True only when the sink acknowledges the entire message; false when
 * no sink exists, delivery is unacknowledged, or the sink throws synchronously.
 */
export function log(level: LogLevel, message: string, fields: Attributes = {}): boolean {
    const active = context.active();
    const sink = active.getValue(sinkKey) as LogSink | undefined;
    const span = trace.getSpan(active)?.spanContext();
    try {
        return sink?.(level, message, {
            ...active.getValue(fieldsKey) as Attributes | undefined,
            ...fields,
            ...(span && trace.isSpanContextValid(span) ? { trace_id: span.traceId, span_id: span.spanId } : {}),
        }) === true;
    } catch { return false; }
}

/** Options evaluated for each invocation of an instrumented function or method. */
export type InstrumentOptions<Args extends unknown[]> = {
    /** Human-readable action, not inherited by children. Unlabelled operations remain trace-only in the CLI. */
    label?: string;
    /** Explicitly select non-secret attributes. Arguments and results are never captured automatically. */
    fields?: (args: Args) => Attributes;
};

function wrapFunction<This, Args extends unknown[], Result>(name: string, fn: (this: This, ...args: Args) => Result, options: InstrumentOptions<Args> = {}): (this: This, ...args: Args) => Result {
    return function (this: This, ...args: Args): Result {
        let fields: Attributes = {};
        let span: Span | undefined;
        try {
            fields = { ...context.active().getValue(fieldsKey) as Attributes | undefined, ...options.fields?.(args) };
            span = trace.getTracer('@common/opentelemetry-decorators').startSpan(name, { attributes: { ...fields, ...(options.label ? { [operationLabel]: options.label } : {}) } });
        } catch { /* Execute the application exactly once even if a processor fails. */ }
        const active = context.active().setValue(fieldsKey, fields);
        return context.with(span ? trace.setSpan(active, span) : active, () => {
            const finish = (failed: boolean) => {
                try {
                    if (failed) span?.setStatus({ code: SpanStatusCode.ERROR });
                    // Exception messages can contain subprocess input or credentials; callers log safe diagnostics.
                    span?.end();
                } catch { /* Preserve the original result or error. */ }
            };
            try {
                const result = fn.apply(this, args) as Result;
                if (result instanceof Promise) {
                    return result.then((value) => {
                        finish(false);
                        return value;
                    }, (error: unknown) => {
                        finish(true);
                        throw error;
                    }) as Result;
                }
                finish(false);
                return result;
            } catch (error) {
                finish(true);
                throw error;
            }
        });
    };
}

/**
 * Wraps a function, creating an active span on every invocation.
 *
 * @param name - Stable operation name for tracing.
 * @param fn - Function to wrap; it is not executed until the wrapper is called.
 * @param options - Presentation label and argument-based attribute selector.
 * @returns A wrapper preserving `this`, arguments, synchronous results, and
 * Promise fulfillment values. Thrown errors and rejection reasons propagate unchanged.
 * @remarks The span ends on return or native Promise settlement; failures mark it
 * ERROR without recording exception messages. Streams, generators and other
 * thenables do not extend its lifetime. Selected fields are inherited by nested
 * operations and logs, with child fields overriding parent fields locally.
 * Synchronous selector and span-processor errors are isolated from application
 * results. The application owns SDK setup and asynchronous context propagation.
 *
 * @example
 * ```ts
 * const sync = instrument('service.sync', async (name: string) => {
 *     log('info', 'Synchronizing');
 * }, { fields: ([name]) => ({ environment: name }) });
 * await sync('production');
 * ```
 */
export function instrument<This, Args extends unknown[], Result>(name: string, fn: (this: This, ...args: Args) => Result, options?: InstrumentOptions<Args>): (this: This, ...args: Args) => Result;
/**
 * Decorates a method with the same span lifecycle as the function-wrapper overload.
 *
 * @param name - Stable operation name for tracing.
 * @param options - Presentation label and argument-based attribute selector.
 * @returns A legacy TypeScript method decorator for `experimentalDecorators`.
 * @remarks Pass a function as the second argument to wrap it instead. This
 * decorator does not support standard ECMAScript decorators. Field selectors may
 * require an explicit argument tuple annotation, as shown below.
 *
 * @example
 * ```ts
 * class Service {
 *     @instrument('service.sync', {
 *         fields: ([name]: [string]) => ({ environment: name }),
 *     })
 *     async sync(name: string) {
 *         log('info', 'Synchronizing');
 *     }
 * }
 * ```
 */
export function instrument<Args extends unknown[]>(name: string, options?: InstrumentOptions<Args>): <This, Result>(_target: object, _key: string | symbol, descriptor: TypedPropertyDescriptor<(this: This, ...args: Args) => Result>) => void;
export function instrument<This, Args extends unknown[], Result>(name: string, fnOrOptions: ((this: This, ...args: Args) => Result) | InstrumentOptions<Args> = {}, options: InstrumentOptions<Args> = {}) {
    if (typeof fnOrOptions === 'function') {
        return wrapFunction(name, fnOrOptions, options);
    }
    return <This, Result>(_target: object, _key: string | symbol, descriptor: TypedPropertyDescriptor<(this: This, ...args: Args) => Result>): void => {
        descriptor.value = wrapFunction(name, descriptor.value!, fnOrOptions);
    };
}

/** Options for immediately executing work with {@link withSpan}. */
export type WithSpanOptions = {
    /** Human-readable action, not inherited by children. Unlabelled operations remain trace-only in the CLI. */
    label?: string;
    /** Explicit non-secret attributes, overriding inherited fields for this scope. */
    fields?: Attributes;
};

/**
 * Immediately executes a callback inside a new active span.
 *
 * @param name - Stable operation name for tracing.
 * @param callback - Synchronous or native Promise-returning work to execute once.
 * @param options - Presentation label and fields supplied directly, without an
 * argument selector.
 * @returns The callback's synchronous result or a Promise with its fulfillment
 * value. Application errors and rejection reasons propagate unchanged.
 * @remarks Uses the same lifecycle, field inheritance and telemetry-error
 * isolation as {@link instrument}. The span ends on return or native Promise
 * settlement and is marked ERROR on failure, without recording exception text.
 * Await all work belonging to the span inside the callback; streams, generators
 * and other thenables do not extend its lifetime. Unlike OpenTelemetry's
 * `startActiveSpan`, callers do not need to end the span themselves.
 *
 * @example
 * ```ts
 * const result = await withSpan('service.sync', async () => {
 *     log('info', 'Synchronizing');
 *     return 42;
 * }, { label: 'Synchronizing', fields: { environment: 'production' } });
 * ```
 */
export function withSpan<Result>(name: string, callback: () => Result, options: WithSpanOptions = {}): Result {
    return wrapFunction(name, callback, { label: options.label, fields: () => options.fields ?? {} })();
}
