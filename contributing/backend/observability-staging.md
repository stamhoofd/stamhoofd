# Staging observability acceptance

Use a separately authorized staging slice with synthetic data. Record the exact
application revision, release/build, service/host inventory, UTC interval,
reviewer and redacted evidence links for each gate. A local passing test does
not establish provider ingestion, release identity, retention or navigation.

## Local usefulness checkpoint (no destination)

`stam dev backend` captures instrumented requests and jobs by default, with a compact waterfall. Use
`--trace-filter 'PATCH /invoices'` or `--trace-filter statistics.cycle` for
recurring matches; `--trace-detail summary|compact|full` changes presentation,
not capture or production sampling. Use `full` for all captured operations. Without a template the local
root shows its matched static endpoint identity. Never infer the URL from SQL.

To repeat the synthetic checks with the managed test infrastructure:

- `stam test api trace-organization trace-collections trace-response-log`: verify a
  synthetic `GET /organization`, its bearer/scope and batched assembly stages,
  and the static fallback for `GetInvoicesCountEndpoint`. Verify untraced successes
  still log. Local SQL identifies verified physical owners, including joined models;
  unknown raw SQL has no table label. Check the separate decoded provider trace for
  the same stages and parentage without the local endpoint identity or table names.
- `STAM_BACKEND_TRACE_SMOKE=1 stam test api trace-waterfall-upload`: a numbered
  invoice PATCH renders successfully, then the storage operation fails. Check the
  renderer and upload branches in the **same** trace.
- `stam test statistics-syncer worker-metrics`: a scheduler cycle fails at pool
  checkout before SQL executes; the next completed cycle reaches settlement.
- `stam test cli dev-trace-producer`: inspect the formatter assertions for the
  loopback producer trees, recurring filters and all three detail levels.

## Authorized staging gates

1. **Before sending:** identify each destination, access owner, region, effective
   retention and deletion (including archives, downstream copies and overrides).
   Compare detailed logs to seven days, Errors to 30 days and traces to the
   provisional 14-day target. Resolve discrepancies before enabling that signal.
2. **Metrics and scheduled jobs:** follow the [metrics verification](metrics.md#staging-release).
   Record fresh samples for each configured host/role and compare before/after
   counts for a synthetic read. Observe ordinary worker completions; do not
   trigger billing, backup or customer work. Check existing heartbeat schedules
   against actual expected completions, not process uptime.
3. **Detailed logs:** follow the [dedicated-source gate](log-privacy.md#before-dev-29-forwarding).
   Verify the collector reads only the reviewed descriptor-backed file, rejects
   malformed records, preserves only approved fields and never ingests mixed
   output. Record one synthetic stored record and the negative canary results.
4. **Errors and private maps:** follow the [Errors staging procedure](exception-privacy.md#staging-runbook-requires-separate-authorization)
   against the exact served build. Record private upload processing, original
   source positions, grouping, typed-error exclusion and disabled-path results.
5. **Traces:** only after trace retention approval, configure the signal-specific
   destination on the selected processes. Verify one synthetic sampled request:
   API server → renderer client → signed renderer server, with bounded operation
   fields, correct parent IDs and no raw SQL, collection names, identifiers,
   headers, exception text or provider responses. Observe a statistics cycle if
   that role is in scope. Do not increase sampling to force evidence.
6. **Correlation:** after independent trace and log ingestion is confirmed,
   produce an approved synthetic matched 500. Starting from its stored dedicated
   `http.response` record, open the trace by `trace_id` and locate the server span
   by `span_id`; starting from that span, find the same record by both IDs. Save
   redacted query/permalink evidence and verify that concurrent requests do not
   cross-match. Confirm an unsampled or pre-handler 500 has neither ID. Missing
   provider navigation blocks correlation acceptance, not metrics or standalone
   tracing.

If a canary leaks or the wrong source is ingested, stop that signal's collector
and export opt-in, preserve redacted evidence and follow the destination owner's
deletion process. For routine rollback, remove the relevant opt-in, restart or
replace the affected build, and verify fresh ingestion stops while independent
signals still arrive. Browser reporting requires replacing the shipped bundle or
revoking its destination. Record outstanding gates explicitly before rollout.
