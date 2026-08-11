# Metabase

Everything that configures Metabase: the ledenstatistieken report and the API client that writes it.

| | |
|---|---|
| `report/*.sql` | The report, one file per tab, as queries on the platform statistics database |
| `src/report.ts` | Reads those files. Knows nothing about Metabase |
| `src/api.ts` | Minimal client for the Metabase HTTP API |
| `src/sync-report.ts` | Says the report in Metabase's vocabulary and writes it |
| `src/naming.ts` | What things are called in Metabase, so every caller agrees |

Installing Metabase differs per environment — Docker locally (`stam metabase start`), a jar under
systemd on a server (`yarn metabase install` in devops) — but configuring it is the same HTTP calls
either way. That is why this package holds no install logic and no credentials: a caller passes the
base URL, an admin account and the data source to write against.

It deliberately has no runtime dependency on the backend. The report tests do use
`@stamhoofd/statistics-db` to build the real schema and run every card against it, which is what
catches a renamed column before a dashboard does.

```bash
yarn stam test metabase
```
