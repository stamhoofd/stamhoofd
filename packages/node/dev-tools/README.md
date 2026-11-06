# Development integration

`@node/dev-tools` owns the typed Stam development protocol and producer adapters.
It uses Node built-ins, TypeScript and concurrently; importing an emitter does not load the
CLI, a telemetry SDK, Vite, or Nuxt. Framework dependencies provide adapter types.

The CLI's dependency graph builds this package before starting development
processes. Its output is independent of the CLI's `dist`, which is cleared during
CLI rebuilds. `stam dev docs` prepares the docs observability dependency graph too.
Restart the development session after changing tooling code.

Application selection, asset preparation, and watch-command construction belong to
`shared/cli/src/runtime/dev-commands.ts` and `shared/cli/src/workflows/start-dev.ts`.
They resolve repository paths from the CLI context; this package owns the executable
adapters and transport, not application orchestration. Entry-point TSDoc describes
environment requirements, working directories, and lifecycle cleanup.

## Entry points

- `events`: validated versioned messages and bounded, best-effort socket emission.
- `application`: supervisor-injected bridge from application diagnostics to development events.
- `vite` and `nuxt`: framework hooks translated into build/readiness transitions.
- `supervise`: executable wrapper reporting process incarnation and exit.
- `concurrently`: named process runner preserving application output and errors while shortening exit notices and suppressing expected shutdown notices. Application selection and command construction remain in the CLI.
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
