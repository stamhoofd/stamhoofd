# simple-networking

Simple and extendable frontend for simple-endpoints

Use the private `@common/networking` workspace with `workspace:*` dependencies.
Run `pnpm stam test common-networking`, `pnpm stam check lint @common/networking`,
and `pnpm stam check typecheck @common/networking` from the repository root.
The `networking` test selector still belongs to the frontend service suite.

The integration retains ES2019 assignment-style class fields to preserve the
existing request and middleware behavior.

The internal fetch body follows `XMLHttpRequestBodyInit`, including the platform's
restriction to non-shared array buffers.

See [requests, middleware and cancellation](docs/requests.md) for usage and the owning API contracts.
