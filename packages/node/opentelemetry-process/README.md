# OpenTelemetry subprocess instrumentation

`runProcess(command, args, options)` starts a subprocess inside an instrumented
span and returns `{ code, stdout, stderr }`. Nonzero exits mark the span failed;
the caller decides whether to throw. Spawn failures reject. The application owns
the OpenTelemetry SDK and any log sink; importing this package configures neither.

Pass `label` to render the process span itself as a labelled operation. Callers do
not need a second instrumentation wrapper solely to show subprocess progress.

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
`input` also accepts a Node Readable; pipeline backpressure limits writes to the
child. `inheritStdin` retains interactive input while capturing/redacting output.
Do not combine inherited stdin with `input`.

`signal` cancels execution; `timeoutMs` sets a deadline. Both send SIGTERM, followed
by SIGKILL after `killAfterMs` (default two seconds). `processGroup: true` includes
descendants on POSIX; Windows terminates the direct child only. The result retains
the exit `signal` and a `reason` for cancellation, timeout, capture overflow or input
failure. Cancellation returns code 130; timeout returns 124; other signal exits use
128 plus the signal number. An already aborted signal starts no process.

Captured/sanitized stdout defaults to 16 MiB of characters (`maxCaptureChars`).
Overflow terminates the process with code 1 and `reason: 'output-limit'`; never parse
stdout from a failed result as complete JSON. Streamed diagnostics are capped at
1 MiB (`maxDiagnosticChars`) with a truncation notice, bounding writes even to a
slow sink. Pipes continue draining and the redacted stderr tail remains available.
`inheritStdio` preserves interactive passthrough for legacy callers; it bypasses
capture, redaction and output events and must not be used for credential reads.

Run `pnpm stam test opentelemetry-process` for the initial subprocess/redaction
checks. Broader coverage will follow behavior review.

The process runner never reports a final failure itself. The command boundary owns
that report: throw `processError(context, command, result)` for a failed result.
It includes redacted stderr unless the sink acknowledged every stderr chunk (the
`stderrReported` result field). Quiet/filtered output and truncated diagnostics
therefore retain failure details; verbose output gets only the contextual summary.
Redacted stderr remains available in the result regardless of presentation. Custom
sinks must return `true` only after presenting the complete diagnostic.
