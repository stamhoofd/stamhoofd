# Coordinated terminal output

Create one `Terminal` per CLI invocation and inject it into participating renderers.
`createRegion()` gives each renderer independent `update`, `finish`, and `dispose`
methods. Live regions are TTY-only; permanent `write` and `finish` output also works
with redirected streams. Applications choose plain progress messages themselves.

`withPrompt(async () => ...)` clears live regions and restores stream methods while
the callback owns the terminal. Region updates are retained. Coordinated writes
are buffered up to 64 KiB of text, then omitted with a notice; they replay after the
outermost prompt finishes, including on rejection. Prompt code writes directly to
its streams. Use this scope for interactive inherited-stdio subprocesses too.
The callback may also use its `write(text)` argument to write prompt output to the
coordinator's destination immediately, without buffering it.

`withTransientOutput(pending, callback, completed)` shows a fixed pending line
above a short interaction. The callback must route all output through its supplied
writer. On success the interaction is replaced with `completed(true)`; failure
retains output and prints `completed(false)`. Redirected output, terminal resizing,
scrolling, non-ASCII text and cursor controls retain the original output instead
of attempting an unsafe erase. Password input remains owned by the subprocess.

Call `dispose()` at the invocation boundary. `StdSync` is the legacy single-block
API, re-exported by `@stamhoofd/stdsync` for incremental migration. Do not construct
independent terminal owners over the same streams during one invocation.

Run `pnpm stam test terminal`, `pnpm stam check lint @node/terminal`, and
`pnpm stam check typecheck @node/terminal`.
