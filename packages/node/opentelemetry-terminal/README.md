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
    await withLogSink(terminal.log, () => instrumentFunction('sync', sync, { label: 'Synchronizing' })());
} finally {
    await sdk.shutdown();
}
```

Imports come from `@node/opentelemetry-terminal`, `@opentelemetry/sdk-node`, and
`@common/opentelemetry-decorators`. Add an exporter processor alongside the
renderer for remote traces. Progress requires recording spans; a sampler that
drops spans also removes their progress notifications.

Normal mode shows all labelled operations and info/warning/error messages.
Verbose adds debug messages, including command/output diagnostics. Quiet shows
warnings and errors. Errors thrown by the application are reported by its command
boundary; the renderer only marks failed progress lines.

Output defaults to stderr, or the supplied `stream`. Inject a shared `terminal`
from `@node/terminal` to coordinate multiple renderers and prompts. The renderer
disposes only its own region; the application disposes the injected coordinator.
Non-TTY streams receive plain start/completion lines.
`groupBy` selects context attributes to display as headings. Secrets must be
sanitized before reaching this renderer.

Chalk styling uses bold group headings, cyan progress, green/red completion,
dim commands and timings, and yellow warnings. Process output is indented beneath
its labelled ancestor with a muted gutter; stderr is explicitly labelled. Split
chunks keep their original text together, and incomplete lines are terminated
before a new diagnostic or completion line. Child output itself is not recolored.
Color support follows the destination stream; `NO_COLOR` disables renderer colors.
Use `color: false` to disable styling or `color: true` to force basic color in an
embedded renderer. This never adds ANSI codes to log events or exported spans.

Run `pnpm stam test opentelemetry-terminal` for the initial lifecycle smoke test.
Interactive behavior is being reviewed before broader renderer coverage is added.
