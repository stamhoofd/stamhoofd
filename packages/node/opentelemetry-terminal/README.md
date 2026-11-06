# OpenTelemetry terminal renderer

`TerminalRenderer` implements the official OpenTelemetry `SpanProcessor` and
provides a scoped `log` sink. Applications own SDK initialization and shutdown.
It renders spans with an `operation.label` attribute, including nesting, duration
and failure status. It has no knowledge of CLI commands or infrastructure items.

```ts
const terminal = new TerminalRenderer({ verbosity: 'normal', groupBy: ['environment'] });
const sdk = new NodeSDK({ spanProcessors: [terminal] });
sdk.start();
try {
    await withLogSink(terminal.log, () => withSpan('sync', sync, { label: 'Synchronizing' }));
} finally {
    await sdk.shutdown();
}
```

Imports come from `@node/opentelemetry-terminal`, `@opentelemetry/sdk-node`, and
`@common/opentelemetry-decorators`. Add an exporter processor alongside the
renderer for remote traces. Progress requires recording spans; a sampler that
drops spans also removes their progress notifications.

Normal mode shows descriptively labelled operations and info/warning/error messages.
Spans with `operation.label.kind: 'command'` are trace-only unless verbosity is
`verbose`. In verbose mode they appear nested beneath their labelled parent;
filtering presentation does not discard exported spans or their ancestry.
Info records with `operation.progress: true` update the active span's live detail
in a TTY; redirected output receives ordinary progress lines instead. The original
operation label is retained for completion output:

```ts
await withSpan('files.scan', async () => {
    log('info', '25/100 files', { 'operation.progress': true });
    // Await the remaining work here.
}, { label: 'Scanning files' });
```

```text
⠋ Scanning files — 25/100 files — 0.4s
```

The live line is replaced on completion by `✓ Scanning files — 1.0s`
(actual durations vary), or `✗` if the span failed.
Set the span attribute `operation.summary` to append a final result to that
completion line, for example `✓ Tests: api — 42 passed — 1.0s`. Progress events
with `operation.progress.liveOnly: true` update TTY progress but do not print
intermediate lines in redirected/CI output. Neither replaces the operation label.
Verbose adds debug messages, including command/output diagnostics. Quiet shows
warnings and errors. Errors thrown by the application are reported by its command
boundary; the renderer only marks failed progress lines.

Output defaults to stderr, or the supplied `stream`. Inject a shared `terminal`
from `@node/terminal` to coordinate multiple renderers and prompts. The renderer
disposes only its own region; the application disposes the injected coordinator.
`TerminalRendererOptions` accepts either `terminal` or `stream`, not both. Color
detection uses the actual destination, including when a terminal is injected.
Non-TTY streams receive plain start/completion lines.
`groupBy` selects context attributes to display as headings. Secrets must be
sanitized before reaching this renderer.

Chalk styling uses bold group headings, cyan progress, green/red completion,
dim commands and timings, and yellow warnings. Labels marked
`operation.label.kind: 'command'` are dimmed
in live progress and start/completion lines; descriptive labels keep normal styling.
Process output is indented beneath
its labelled ancestor with a muted gutter; stderr is explicitly labelled. Split
chunks keep their original text together, and incomplete lines are terminated
before a new diagnostic or completion line. Child output itself is not recolored.
Output records with `diagnostic.output.style: 'plain'` omit gutters and indentation
while retaining coordinated writes and partial-line handling.
Color support follows the destination stream; `NO_COLOR` disables renderer colors.
Use `color: false` to disable styling or `color: true` to force basic color in an
embedded renderer. This never adds ANSI codes to log events or exported spans.

`withInteractiveOperation(label, callback)` shows a static yellow `?` and dim
command while the callback owns prompt output. Successful short interactions
collapse to a green `✓` line; failures preserve output and show `✗`. Quiet mode
still displays the prompt, but omits progress. Labels must already be redacted.

## Lifecycle

Call `shutdown()` through SDK shutdown or explicitly when finished. It stops the
animation, terminates partial output, clears tracked spans and disposes its region.
An internally created terminal is disposed too. Repeated shutdown calls are no-ops.
Cleanup is still attempted if output fails; that shutdown call rejects with the
cleanup failure. Later span notifications are ignored and `log` returns false.
An interactive callback invoked after shutdown still runs, but its writer returns
false and produces no output.

`forceFlush()` is a no-op: rendering is synchronous, and any prompt buffering is
owned by the terminal coordinator rather than the span processor.

Run `pnpm stam test opentelemetry-terminal` and `pnpm stam test terminal` for
renderer and terminal-coordination verification. Public API contracts are available
as TSDoc in `src/terminal.ts`.
