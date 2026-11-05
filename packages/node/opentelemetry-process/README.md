# OpenTelemetry subprocess instrumentation

`runProcess(command, args, options)` starts a subprocess inside an instrumented
span and returns `{ code, stdout, stderr }`. Nonzero exits mark the span failed;
the caller decides whether to throw. Spawn failures reject. The application owns
the OpenTelemetry SDK and any log sink; importing this package configures neither.

Command diagnostics are debug events. Output defaults to debug (`output:
'verbose'`); use `'always'` for info-level output needed in normal operation, such
as a deployment plan. Events carry `diagnostic.kind` (`command`, `stdout`, or
`stderr`) and are routed through the common library's scoped sink. An explicit
`log` callback supports applications without a scoped sink. Output is not exported
as span attributes or events.

`capture: true` returns raw stdout for the caller to parse. Stderr is redacted and
bounded to its last 8192 characters, with explicit empty/truncated markers.
`redact` supplies known secret values, including JSON-escaped representations;
streaming redaction holds potential secret prefixes across chunk boundaries.
Overlapping matches are merged before emission so neither command diagnostics nor
stream boundaries expose fragments of overlapping credentials.
No secret discovery or environment-variable classification is performed here.

Use `sanitizeStdout` for credential-bearing structured output. It buffers stdout,
passes it through the caller's sanitizer, then emits redacted diagnostics. If the
sanitizer fails, only a withheld-output marker is emitted. Raw captured stdout is
still returned. Without a sanitizer, stdout streams incrementally. Never put
unknown credentials in command arguments: the command is logged before execution.

`env` replaces the child environment when supplied. `input` supplies stdin, but
tools that require a native pipe may need an explicit template file instead.
`inheritStdio` preserves interactive passthrough for legacy callers; it bypasses
capture, redaction and output events and must not be used for credential reads.

Run `pnpm stam test opentelemetry-process` for the initial subprocess/redaction
checks. Broader coverage will follow behavior review.
