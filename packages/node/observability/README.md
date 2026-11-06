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
