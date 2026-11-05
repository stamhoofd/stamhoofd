import { context, createContextKey, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';

const fieldsKey = createContextKey('stamhoofd.telemetry.fields');
const sinkKey = createContextKey('stamhoofd.telemetry.log-sink');
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSink = (level: LogLevel, message: string, fields: Attributes) => void;

/** Presentation conventions shared by instrumentation and optional renderers. */
export const operationLabel = 'operation.label';
export const diagnosticKind = 'diagnostic.kind';

/** Mark non-throwing failures, such as a subprocess returning a nonzero exit code. */
export function markSpanFailed(): void {
    trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
}

/** Configure output for one asynchronous scope; importing this library has no side effects. */
export function withLogSink<T>(sink: LogSink, callback: () => T): T {
    return context.with(context.active().setValue(sinkKey, sink), callback);
}

export function hasLogSink(): boolean {
    return context.active().getValue(sinkKey) !== undefined;
}

export function log(level: LogLevel, message: string, fields: Attributes = {}): void {
    const active = context.active();
    const sink = active.getValue(sinkKey) as LogSink | undefined;
    const span = trace.getSpan(active)?.spanContext();
    sink?.(level, message, {
        ...active.getValue(fieldsKey) as Attributes | undefined,
        ...fields,
        ...(span && trace.isSpanContextValid(span) ? { trace_id: span.traceId, span_id: span.spanId } : {}),
    });
}

export type InstrumentOptions<Args extends unknown[]> = {
    /** Optional human-readable action. Unlabelled operations remain trace-only in the CLI. */
    label?: string;
    /** Explicitly select non-secret attributes. Arguments and results are never captured automatically. */
    fields?: (args: Args) => Attributes;
};

/** Instrument synchronous or Promise-returning functions. Streams/generators need explicit lifetime instrumentation. */
export function instrumentFunction<This, Args extends unknown[], Result>(name: string, fn: (this: This, ...args: Args) => Result, options: InstrumentOptions<Args> = {}): (this: This, ...args: Args) => Result {
    return function (this: This, ...args: Args): Result {
        const fields = { ...context.active().getValue(fieldsKey) as Attributes | undefined, ...options.fields?.(args) };
        return context.with(context.active().setValue(fieldsKey, fields), () => trace.getTracer('@common/opentelemetry-decorators').startActiveSpan(name, { attributes: { ...fields, ...(options.label ? { [operationLabel]: options.label } : {}) } }, (span) => {
            const finish = (failed: boolean) => {
                if (failed) span.setStatus({ code: SpanStatusCode.ERROR });
                // Exception messages can contain subprocess input or credentials; callers log safe diagnostics.
                span.end();
            };
            try {
                const result = fn.apply(this, args) as Result;
                if (result instanceof Promise) {
                    return result.then((value) => { finish(false); return value; }, (error: unknown) => { finish(true); throw error; }) as Result;
                }
                finish(false);
                return result;
            } catch (error) {
                finish(true);
                throw error;
            }
        }));
    };
}

/** Legacy TypeScript method decorator, matching this repository's experimentalDecorators configuration. */
export function instrument<Args extends unknown[]>(name: string, options: InstrumentOptions<Args> = {}) {
    return <This, Result>(_target: object, _key: string | symbol, descriptor: TypedPropertyDescriptor<(this: This, ...args: Args) => Result>): void => {
        descriptor.value = instrumentFunction(name, descriptor.value!, options);
    };
}
