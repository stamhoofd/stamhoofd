# Application observability

`@node/observability` is the shared Node lifecycle and server telemetry boundary.
Executable entry points use `runApplication(service, initialize)` before loading
application configuration. The callback receives an `ApplicationLifecycle`:

```ts
await runApplication('api', async (lifecycle) => {
    const server = await initializeApi();
    await lifecycle.ready(server);
    // Existing shutdown ownership calls lifecycle.close() after application cleanup.
});
```

Readiness always waits for initialization and the optional HTTP listener, regardless
of telemetry configuration. Statistics uses `ready()` without a server. Background
jobs are separate operations. Library callers can create an `ApplicationLifecycle`
without initializing an SDK or installing signal handlers. Executable bootstrap
owns SDK flushing; this library never exits the process.

Lifecycle transitions also publish on `stamhoofd.application.lifecycle` through
Node's diagnostics channel. Stam's supervisor loads its development adapter before
the application starts. Applications have no dependency on the CLI or socket client.
Subscribers must catch their own failures because Node treats subscriber exceptions
as uncaught errors.

## Application metrics

Set `STAM_METRICS_PORT` to an unused TCP port per process to enable a Prometheus
scrape at `http://127.0.0.1:<port>/metrics`. Vector must scrape from the same
network namespace. Metrics are off by default and do not enable traces or logs.
`service_name` is the executable's service name (or `OTEL_SERVICE_NAME`).
DevOps controls this single switch in process configuration: set a distinct port
for each staging service sharing a network namespace; leave it unset in production
until rollout. An unset port installs no metric subscribers or scrape listener.

API, renderer, redirecter, backup and docs measure incoming requests. The
`stamhoofd_http_requests_in_flight` gauge includes open responses, including streams.
`stamhoofd_http_request_duration_milliseconds` ends when the response finishes
writing or closes prematurely. Its `_count` is completed demand, broken down by
`method` (unknown methods become `_OTHER`) and `status_class` (`1xx`–`5xx`,
`other`, or `aborted`). Use `5xx` for server errors and `aborted` for incomplete
responses; `4xx` remains visible separately. No URL or route is a metric label.
On a successful scrape, an idle backend reports zero in flight. A duration series
appears only after its first completion; a failed scrape does not mean zero traffic.
The scrape listener itself does not count. Statistics syncer has no HTTP listener.

To smoke-test the compiled backend entries, run `pnpm build:backend:apps` and
`STAM_BACKEND_METRICS_SMOKE=1 pnpm stam test api http-entry-smoke`. The test uses
Stam's managed test database and runs backup in development mode to skip backup jobs.
`STAM_NUXT_METRICS_SMOKE=1 pnpm stam test observability nuxt-metrics` exercises
the docs module in a Nuxt development worker and a built Nitro production server.

The `stamhoofd_db_acquire_duration_milliseconds` histogram measures pool checkout,
including connection setup and waiting for a slot. `stamhoofd_db_execute_duration_milliseconds`
measures the driver call after checkout, including result transfer, for the
`select`, `insert`, `update`, `delete` and `statement` wrapper methods. Explicit
and transaction connections reuse their checkout; their queries still count.
Both histograms label completed attempts with `outcome="success"` or `"error"`.
No SQL, bindings, error details or database identifiers are collected.

## OTLP configuration

Set `OTEL_EXPORTER_OTLP_ENDPOINT` or signal-specific traces/logs endpoint variables
at runtime to enable export. The SDK uses HTTP/protobuf and standard OTLP headers.
`OTEL_SERVICE_NAME` overrides the service name. From `OTEL_RESOURCE_ATTRIBUTES`,
only `service.version` and `deployment.environment.name` are retained. Instance
identity is generated per process. Exporters use 1.5-second request deadlines;
SDK shutdown is idempotent and bounded to two seconds.

The initial pilot exports only this package's named lifecycle/server spans and
fixed lifecycle/error log identifiers. Export adapters strip unapproved attributes,
span events, links, and status messages. Route attributes must come from registered
framework route templates, never request URLs. No automatic console, HTTP, SQL,
host, or process capture is enabled. This is not a sanitizer for arbitrary existing
application logging; broader instrumentation requires extending and testing the
explicit export contract.

Run `pnpm stam test observability`, `pnpm stam check lint --filter @node/observability`, and
`pnpm stam check typecheck --filter @node/observability` from the repository root.
