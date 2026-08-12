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
base URL, the credentials and the data source to write against.

| | Local | Server |
|---|---|---|
| Written by | `stam metabase report` | `yarn metabase report -s keeo/keeo-metabase-001` |
| Authenticates with | the admin account the CLI created | an api key from 1Password |
| Data source | registered by the CLI | added once by hand, looked up by name |

The two auth modes exist because the environments differ in what they may hold. Locally the CLI
completes the setup wizard itself and knows the password. A server's first account is made by a
person, and nothing may store their password, so it uses an api key created under
Admin > Settings > Authentication > API keys. `verifyApiKey()` checks it belongs to an admin before
anything is written, so a revoked key fails up front instead of halfway through the report.

It deliberately has no runtime dependency on the backend. The report tests do use
`@stamhoofd/statistics-db` to build the real schema and run every card against it, which is what
catches a renamed column before a dashboard does.

```bash
yarn stam test metabase
```
