# Documentation image

Build from the repository root without a DevOps checkout or cloud credentials:

```sh
pnpm stam docs image build v1.2.3
docker run --rm -p 8080:8080 docs:v1.2.3
```

The image runs Nuxt's Node server, including Nuxt Content search, as an unprivileged
user on port 8080. SQLite content is built into the image; local runtime storage is
ephemeral and contains no authoritative data. The build context excludes DevOps,
environment files, local content databases and generated outputs.

The build command reads the pinned Node version from the root `.nvmrc` and passes
it to both Docker stages. Update `.nvmrc` to update local setup, CI and the docs
image together. For major upgrades, also review the supported `engines.node`
range in the root `package.json`.

Publishing and deployment instructions live in the private checkout's
[docs feature guide](../devops/infra/scaleway/features/docs/README.md#publishing-the-image).

## Staging observability

The docs Node server uses the same lifecycle/OTLP library as the backend apps.
Its Nuxt module instruments startup and HTTP responses in development and production.
The image builds the small observability dependency graph before Nuxt; it still
runs as an unprivileged user on port 8080 with TLS terminated by the deployment proxy.

Configure these variables on the running container, not while building the image:

```sh
OTEL_SERVICE_NAME=stamhoofd-docs
OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=staging,service.version=<image-tag>
OTEL_EXPORTER_OTLP_ENDPOINT=https://<better-stack-ingesting-host>
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20<source-token>
```

The SDK sends HTTP/protobuf to `/v1/traces` and `/v1/logs`. Inject the header through
the deployment secret configuration. No collector is required for this pilot.
Omitting the endpoint disables remote export without changing readiness behavior.
The same variables can be used locally alongside the Stam footer.

The initial export contract includes startup, readiness, graceful shutdown, and
request method/status/duration with registered route templates. It excludes raw
URLs, request content, arbitrary console logs, and exception messages. A server 5xx
produces a fixed failure log correlated with the request trace. Browser telemetry
is not enabled. Source retention is configured in Better Stack, not by this image.

After deployment, verify the service/environment/release in Better Stack, request
a normal page and a missing page, and verify startup and request traces. Confirm
SIGTERM flushes pending telemetry and that a telemetry outage does not stop the
server. Automated protocol/privacy coverage runs with `pnpm stam test observability`.
