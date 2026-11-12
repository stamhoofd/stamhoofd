# OpenTelemetry decorators

Runtime-neutral instrumentation using the official OpenTelemetry API. Importing this
package does not configure an SDK, export telemetry, or write logs. The application
must initialize an SDK and context manager before executing instrumented operations.

## Choose an entry point

| API                                  | Use when                                                             |
| ------------------------------------ | -------------------------------------------------------------------- |
| `@instrument(name, options?)`        | Decorating a method.                                                 |
| `instrument(name, fn, options?)`     | Defining a reusable instrumented function. Each call creates a span. |
| `withSpan(name, callback, options?)` | Executing a block of work immediately inside a span.                 |

`instrument` distinguishes the forms by its second argument: a function creates
a wrapper, while an options object (or no argument) creates a decorator.
It replaces the former `instrumentFunction` export.

```ts
import { instrument, withSpan, log } from '@common/opentelemetry-decorators';

class Service {
    @instrument('service.sync', { fields: ([name]: [string]) => ({ environment: name }) })
    async sync(name: string) {
        log('info', 'Synchronizing');
    }
}

const sync = instrument(
    'service.sync',
    async (name: string) => {
        log('info', 'Synchronizing');
    },
    { fields: ([name]) => ({ environment: name }) },
);

await sync('production');

// Immediate execution uses plain fields rather than an argument selector.
await withSpan(
    'service.sync',
    async () => {
        log('info', 'Synchronizing');
    },
    { label: 'Synchronizing', fields: { environment: 'production' } },
);
```

The decorator supports the repository's legacy TypeScript method decorators
(`experimentalDecorators`), not standard ECMAScript decorators. Its field selector
may need an explicit argument tuple annotation; wrapper selectors infer arguments
from the supplied function.

## Span lifecycle

The wrapper preserves `this`, synchronous returns, Promise results and thrown errors.
`withSpan` preserves synchronous results too; it does not always return a Promise.
Both automatically end the span on return or native Promise settlement and mark
thrown/rejected failures as ERROR. Unlike OpenTelemetry's `startActiveSpan`, there
is no manual `span.end()` call. Use `markSpanFailed()` for a failure represented
by a result rather than an exception; it marks the active span without ending it.

Synchronous sink, attribute-selector and span-processor failures are isolated from
application results. Sinks are synchronous callbacks; asynchronous transports must
handle their own rejection and buffering. SDK startup/shutdown remains application-owned.
Streams, thenables other than native Promises, and generators are not asynchronous
lifetimes supported by this API. Select attributes explicitly; arguments, return
values and exception messages are never recorded automatically.
Await all work belonging to the operation inside its callback; detached work is
not included in the span's lifetime.

## Fields, labels and logging

Set `label` on an instrumented operation to add the `operation.label` span
attribute. Renderers consume native span start/end notifications for progress;
labels are not inherited by nested operations. Unlabelled spans remain traceable
without producing progress lines. Explicit `log` calls inherit context and IDs;
`diagnostic.kind` identifies command, stdout and stderr events. Output events are
delivered to the scoped sink, not attached to exported spans. `hasLogSink` lets
adapters provide a fallback when used outside an instrumented application.

Nested instrumented operations inherit selected fields through OpenTelemetry Context;
child fields override parent fields locally. `withLogSink` installs a scoped logging
destination. Records include inherited fields and valid active trace/span IDs.
This requires a working async context manager; the CLI uses the Node SDK. Browser
async inheritance is not guaranteed and needs a separate context strategy.

Run `pnpm stam test opentelemetry-decorators` for verification.

Use `diagnostic({ kind: 'command', message })`, `{ kind: 'output', stream,
message, always? }`, or `{ kind: 'failure', message }` instead of constructing
diagnostic attributes manually. These use the scoped sink and inherited fields.
A sink returns `true` only if it presented the entire message. Filtering, failed
delivery, and legacy void sinks are unacknowledged. `log` and `diagnostic` return
this acknowledgement so callers can avoid repeating already presented details.

`log` merges inherited fields, explicit message fields, then valid active
`trace_id` and `span_id` values in that order. `withLogSink(sink, callback)` installs
a sink for the callback's context; nested scopes can override it. It does not flush
or dispose the sink. Without a sink, `log` returns false.

Diagnostics use debug severity for commands and ordinary output, info for output
with `always: true`, and error for failures. A failure diagnostic does not itself
mark the span failed. Passing a custom sink to `diagnostic(event, sink)` bypasses
`log`: that sink receives only the diagnostic-kind attribute, without inherited
fields or trace IDs automatically added.

Public exports include TSDoc contracts and examples for editor hover help in
[`src/instrument.ts`](src/instrument.ts).
