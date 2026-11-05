# Development integration

`@node/dev-tools` owns the typed Stam development protocol and producer adapters.
It depends on Node built-ins and TypeScript; importing an emitter does not load the
CLI, a telemetry SDK, Vite, or Nuxt. Framework dependencies provide adapter types.

The CLI's dependency graph builds this package before starting development
processes. Its output is independent of the CLI's `dist`, which is cleared during
CLI rebuilds. The standalone docs development script prepares this package too.
Restart the development session after changing tooling code.

## Entry points

- `events`: validated versioned messages and bounded, best-effort socket emission.
- `vite` and `nuxt`: framework hooks translated into build/readiness transitions.
- `supervise`: executable wrapper reporting process incarnation and exit.
- `watch-typescript`: compiler watch callbacks translated into build cycles.
- `shared-build`: one shared build and its session-ready marker.
- `turbo`: structured Turbo log forwarding and failed shared-build log replay.

Sequence numbers are emitter-local. Supervisor and child share a process identity
and generation; producer monotonic timestamps order their transitions. Socket
failure disables delivery without preventing application execution. Close emitters
to drain final events with a bounded deadline.

Integration coverage lives with the CLI consumers. Run `pnpm stam test cli`,
`pnpm stam check lint --filter @node/dev-tools`, and
`pnpm stam check typecheck --filter @node/dev-tools` from the repository root.
