# simple-networking

Simple and extendable frontend for simple-endpoints

Inside this repository, depend on `@stamhoofd/common-networking` with `workspace:*`.
Run `pnpm stam test common-networking`, `pnpm stam check lint @stamhoofd/common-networking`,
and `pnpm stam check typecheck @stamhoofd/common-networking` from the repository root.
The `networking` test selector still belongs to the frontend service suite.

The integration retains ES2019 assignment-style class fields to preserve the
existing request and middleware behavior.

The internal fetch body follows `XMLHttpRequestBodyInit`, including the platform's
restriction to non-shared array buffers.

See [requests, middleware and cancellation](docs/requests.md) for usage and the owning API contracts.
