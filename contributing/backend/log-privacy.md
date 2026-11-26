# Backend log privacy and release gate

**Do not forward mixed PM2 stdout/stderr.** A dependency, child process or direct
write can produce any text, including a valid-looking JSON record. A collector
cannot establish provenance from its prefix, fields, service name or filename.

`@node/logging` owns a separate, local JSON-lines writer. All five executable
services initialize it before reading their configuration. By default it has
no dedicated output. For local verification, a supervisor can provide a
private append-only-for-the-writer regular file on descriptor 3 and explicitly
set `STAM_BACKEND_LOG_FD=3`. Use one new, owner-only file per service, separate
from PM2 and child output. The writer rejects a pipe, missing descriptor or
alias of stdout/stderr. Do not expose the descriptor to child processes.
This is a source boundary for trusted application code, not a sandbox against
malicious code running inside the same process.

| Source                                    | Reviewed output                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API, renderer, redirecter and backup HTTP | Method from a fixed set, numeric status and rounded latency; no URL, host, IP, query, headers, body, response or exception. Only 5xx goes to the dedicated sink. |
| SQL, including the statistics worker      | Fixed query-failure or slow-query event; optional elapsed milliseconds. No statement, bindings, row data, EXPLAIN plan or driver message.                        |
| All five entry points                     | Fixed startup-failure or unhandled-rejection event. Scheduled worker failures use a fixed identifier; no command, queue ID, error context or stack.              |

The sink accepts only records constructed by `backendRecord`. Timestamp is
generated locally, service is one of the five compiled roles, and event
determines level. HTTP status is 100–599; elapsed milliseconds is a finite
integer bounded to 0–86,400,000. There are no free-text fields. Unknown events
are dropped; serializer or sink failures never fall back to forwarding the input.
Deployment labels belong to the collector's trusted inventory, not to request
headers or arbitrary environment strings. A dedicated `http.response` 5xx record
may include `trace_id` (32 lowercase hex digits) and `span_id` (16) together.
They identify the same sampled, application-owned provider server span, including
a failure logged after its handler unwinds. Unmatched, unsampled and local-only
requests have neither field. Mixed process streams do not get these IDs. Route
names, request IDs, inbound trace headers and ambient context are never copied.

Local diagnostics are broader: legacy application messages, native crashes,
browser/backup subprocess output, loader failures before initialization,
migration tools and supervisor logs are **not** covered by this schema. Do not
tail them, copy them to the dedicated file or use them to recover dropped
records. The backend SDK does not send logs along with configured OTLP traces.
Docs telemetry is a separate pilot.

Local application logs can identify the affected database record by its internal
ID (including a user or member ID). They can also include the endpoint or cron
name, queue counts, model and column names, provider HTTP status, and application
source locations. Use these to investigate the record in the database; do not
copy its contents, SQL bindings, credentials, or raw exception messages into logs.
These diagnostic fields do not go to the dedicated sink.

The compiled API privacy test also exercises local mail delivery (including SMTP
failure and duplicate recipients), payment polling, disabled file signing, token
resends, member duplicate checks and signed Stripe webhooks. Mock provider calls
verify that a Mollie refresh persists rotated tokens and that a signed Buckaroo
request still sends its payment fields. These tests check the final process streams
and the dedicated file. Delivery callbacks, provider errors and administrator
reports can still carry private details to their recipients; they are not log records.

## Before DEV-29 forwarding

1. Build the five entries (`pnpm run build:backend:apps`), then run
   `STAM_BACKEND_LOG_SMOKE=1 node shared/cli/bin/stam.js test api backend-log-privacy`.
   Tests capture final stdout, stderr and the separate sink with synthetic data.
2. Provision the dedicated source with restricted access, local rotation and
   deletion. Configure the future collector to read **only** that source;
   reject unknown fields, malformed/truncated lines and transform failures.
   Never send the unparsed line to a fallback source or error stream.
3. Verify and record the **effective** detailed-log retention for the intended
   Better Stack source against the provisional **seven-day** target, including
   any default, override or downstream archive. Confirm the per-service mapping
   and synthetic-canary results before enabling ingestion. Effective retention
   has **not** been verified here; forwarding remains off.
