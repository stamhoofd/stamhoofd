# OpenTelemetry decorators

Runtime-neutral instrumentation using the official OpenTelemetry API. Importing this
package does not configure an SDK, export telemetry, or write logs. The application
must initialize an SDK and context manager before executing instrumented operations.

```ts
import { instrument, instrumentFunction, log } from '@common/opentelemetry-decorators';

class Service {
    @instrument('service.sync', { fields: ([name]: [string]) => ({ environment: name }) })
    async sync(name: string) {
        log('info', 'Synchronizing');
    }
}

const sync = instrumentFunction('service.sync', async (name: string) => {
    log('info', 'Synchronizing');
}, { fields: ([name]) => ({ environment: name }) });
```

The decorator supports the repository's legacy TypeScript method decorators.
The wrapper preserves `this`, synchronous returns, Promise results and thrown errors.
Synchronous sink, attribute-selector and span-processor failures are isolated from
application results. Sinks are synchronous callbacks; asynchronous transports must
handle their own rejection and buffering. SDK startup/shutdown remains application-owned.
Streams, thenables other than native Promises, and generators are not asynchronous
lifetimes supported by this API. Select attributes explicitly; arguments, return
values and exception messages are never recorded automatically.

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
