# Backend metrics: release and verification

Application metrics answer what a **process** is doing. The legacy MySQL exporter
answers what the **database server** is doing, including work from other clients.
The [instrument reference](../../packages/node/observability/README.md#application-metrics)
defines the HTTP, database, worker and queue measurements and their local tests.

## Expected coverage

| Process (`service_name` default) | HTTP                                       | Application database timing                                                 | Work                                                | Legacy staging targets configured¹ |
| -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| API (`api`)                      | Yes                                        | Pool checkout and driver calls                                              | Queues, cron dispatch and selected business workers | 5                                  |
| Renderer (`renderer`)            | Yes                                        | No routine DB workload expected                                             | In-process browser acquisition queue                | 4                                  |
| Backup (`backup`)                | Yes                                        | Wrapper calls, e.g. binlog inspection; not external backup commands         | Full backup, binlogs, cleanup and queue             | 0                                  |
| Redirecter (`redirecter`)        | Yes                                        | No routine DB workload expected                                             | No dedicated worker                                 | 0                                  |
| Statistics syncer (`stats`)      | No application HTTP server                 | Administration reads and statistics DB writes share the same process series | Scheduled cycle and three stages                    | 0                                  |
| Docs (`docs`)                    | Nitro dev worker or production Node server | No application MySQL workload expected                                      | No dedicated worker                                 | Outside legacy VM rollout          |

¹ Configuration on 2026-11-25, **not deployed coverage**. The three legacy staging
sources had no HTTP, database or worker application series in their preceding
24-hour catalogs. Compiled-entry tests and local scrapes are evidence of
instrumentation, not of ingestion. Production application collection is disabled.

## Staging release

1. Release a build containing the HTTP, database and worker instruments together.
   Follow the [DevOps staging deployment and rollback runbook](https://github.com/stamhoofd/devops/blob/main/legacy-telemetry.md#staging-application-metrics)
   in the separate DevOps checkout. Deploy the instrumented application first,
   then apply the collector configuration. DevOps owns the host list, role ports,
   credentials and PM2 environment. Do not set a fleet-wide port.
2. On each expected staging host, compare the deployed roles to the configured
   scrape targets. From the collector's network namespace, inspect
   `curl -fsS "http://127.0.0.1:${PORT}/metrics"` with `PORT` set to the role's
   metrics port. Check `service_name`. Perform a known read-only request and
   compare the HTTP `_count` before and after. Use a DB-backed read to check the
   execution histogram; pinned connections need not increment checkout count.
   Observe ordinary worker activity rather than triggering backups or billing.
3. After at least two collector scrapes, check **fresh remote samples** for each
   expected `(platform, environment, instance, service)`. Vector supplies those
   labels: `platform` is the brand, `instance` the full host name, and `service`
   the deployed role (e.g. `statistics-syncer`, distinct from `service_name="stats"`).
   Compare the observed host/role pairs to the expected inventory and record any
   gaps before declaring delivery. PM2 online, a successful local scrape, or
   fresh Caddy/MySQL data alone does not establish application coverage.
4. If verification fails, check the release, loopback listener and Vector target
   in that order. For rollback follow the same runbook: remove only the app
   opt-in, redeploy and reapply telemetry. Confirm the listener is gone and
   infrastructure samples still arrive.

For step 3, run this Better Stack metrics SQL template on each staging source
over the last five minutes. The gauges exist even before a completed request
or job. Compare `latest` to the scrape interval, not just to the release date.

```sql
SELECT label('platform') AS platform, label('instance') AS instance,
       label('service') AS service, name, max(dt) AS latest
FROM {{source}}
WHERE dt >= {{start_time}} AND dt < {{end_time}}
  AND label('environment') = 'staging'
  AND name IN ('stamhoofd_http_requests_in_flight', 'stamhoofd_worker_running')
GROUP BY platform, instance, service, name
ORDER BY platform, instance, service, name
```

## Panel queries

These are **PromQL** for the classic Prometheus series exposed by the application,
using the forwarded staging labels. At a raw scrape endpoint, deployment labels
are not present. In Better Stack SQL charts inspect the source's stored metric
type first: remote write may store a histogram under its base name, rather than
as separate `_bucket` rows. Do not paste PromQL into a ClickHouse SQL chart.

| Panel                                                  | PromQL                                                                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requests/s by result, including 5xx and aborted        | `sum by (platform, service, status_class) (rate(stamhoofd_http_request_duration_milliseconds_count{environment="staging"}[5m]))`                                          |
| HTTP p95, ms, finished responses                       | `histogram_quantile(0.95, sum by (platform, service, le) (rate(stamhoofd_http_request_duration_milliseconds_bucket{environment="staging",status_class!="aborted"}[5m])))` |
| Open responses per instance                            | `sum by (platform, instance, service) (stamhoofd_http_requests_in_flight{environment="staging"})`                                                                         |
| Pool checkout p95, ms                                  | `histogram_quantile(0.95, sum by (platform, service, le) (rate(stamhoofd_db_acquire_duration_milliseconds_bucket{environment="staging"}[5m])))`                           |
| Driver execution p95 by operation, ms                  | `histogram_quantile(0.95, sum by (platform, service, operation, le) (rate(stamhoofd_db_execute_duration_milliseconds_bucket{environment="staging"}[5m])))`                |
| Worker outcomes/s                                      | `sum by (platform, service, worker, outcome) (rate(stamhoofd_worker_outcomes_total{environment="staging"}[5m]))`                                                          |
| Rare worker failures in 24h (estimated increase)       | `sum by (platform, instance, service, worker) (increase(stamhoofd_worker_outcomes_total{environment="staging",outcome="error"}[24h]))`                                    |
| Worker execution p95, ms                               | `histogram_quantile(0.95, sum by (platform, service, worker, le) (rate(stamhoofd_worker_duration_milliseconds_bucket{environment="staging"}[1h])))`                       |
| Queue depth / oldest pending age (seconds), per series | `stamhoofd_queue_pending{environment="staging"}` / `stamhoofd_queue_oldest_pending_milliseconds{environment="staging"} / 1000`                                            |
| Active workers, per series                             | `stamhoofd_worker_running{environment="staging"}`                                                                                                                         |

Apply `rate` or `increase` **before** summing so each process restart is handled
in its own series. Keep `le` when aggregating classic buckets; averaging host
p95s or taking a percentile of cumulative counts gives a different answer.
Never rate a gauge. Loaded workers expose supported outcome counters at zero;
this is not a success or a heartbeat. Events before the first scrape can be
missed by rates. Empty histograms, absent workers and stale targets are not
zero latency, zero work or a healthy service.

## Legacy database evidence

The existing [capacity dashboard](https://telemetry.betterstack.com/team/t226025/dashboards/1194419)
covers host CPU, memory, disk and network, MySQL load and cache pressure, and Caddy
ingress. The [RSS dashboard](https://telemetry.betterstack.com/team/t226025/dashboards/1194449)
covers eligible MySQL and API processes. Caddy measures proxied traffic; adding
it to application request counts would count the same traffic twice.

In Better Stack's legacy sources on 2026-11-25 (22:04–22:34 UTC),
`mysql_global_status_slow_queries` was present for 16 MySQL instances across
seven sources (five staging instances, eleven production). It is a cumulative
server-wide count; use `increase(mysql_global_status_slow_queries[1h])` per
instance. It does not identify SQL text or the responsible application.

Four production instances reported `mysql_slave_status_seconds_behind_source`
and the receiver and applier running gauges: two in Stamhoofd and one each in
Ravot and Keeo. No lag series was observed in the three staging sources.
Require lag only on a configured replica; absent or undefined lag is not zero.
Use thread state and exporter health alongside lag. See the
[legacy capacity panels and version-specific exporter names](https://github.com/stamhoofd/devops/blob/main/legacy-telemetry.md#better-stack-dashboard-and-alerts).
