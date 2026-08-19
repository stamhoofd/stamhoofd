# Metabase

Everything that configures Metabase: the ledenstatistieken report and the API client that writes it.

| | |
|---|---|
| `report/*.sql` | The report, one file per tab, as queries on the platform statistics database |
| `src/report.ts` | Reads those files. Knows nothing about Metabase |
| `src/api.ts` | Minimal client for the Metabase HTTP API |
| `src/sync-report.ts` | Says the report in Metabase's vocabulary and writes it |
| `src/naming.ts` | What things are called in Metabase, so every caller agrees |

One tab is not part of the client's own report. `report/jeugdbewegingen.sql` is the dataset the
koepel delivers to the Departement Cultuur, Jeugd en Media every september, one card per sheet of the
delivery template: tables to download as .xlsx and paste into it rather than charts to read. It names
a `dashboard:` of its own, which writes it as a second dashboard in the collection instead of as a
page of the ledenstatistieken. That is also why those cards name their columns -- Metabase writes the
header of an export from the column's title, and a sheet read by a government department has to keep
the names the template gives it.

The koepel's own organization is treated the other way around by the two. The ledenstatistieken leave
it out wherever they count -- it is the national body, not an eenheid, and the client's own report
counts none of its structuurvrijwilligers -- while the aanlevering is about nothing else.
`platform.membershipOrganizationId` is the only thing that says which organization that is, so
`report/includes/facts.sql` offers the same rows under two names: `facts` without it, `all_facts` with
it. The import writes it under that same id, so both hold in the years imported from the client's own
statistics as well as in the years the sync owns.

Installing Metabase differs per environment — Docker locally (`stam platform-report start`), a jar
under systemd on a server (`yarn metabase install` in devops) — but configuring it is the same HTTP
calls either way. That is why this package holds no install logic and no credentials: a caller passes the
base URL, the credentials and the data source to write against.

| | Local | Server |
|---|---|---|
| Written by | `stam platform-report dashboards` | `yarn metabase report -s keeo/keeo-metabase-001` |
| Authenticates with | the admin account the CLI created | an api key from 1Password |
| Data source | registered by the CLI | added once by hand, looked up by name |

Nothing this writes carries the name of a platform: the collection is `Ledenstatistieken` and holds
the dashboards `Ledenstatistieken` and `Aanlevering ...`, whichever platform they count. A server
holds one platform, and a local Metabase shows the report of the environment written last — writing
another one points the same questions at its data source.

That is also why nothing here trashes a collection. There is one to write into, and a collection this
wrote under the older per-environment name (`Ledenstatistieken (keeo)`) is renamed into it, keeping
the id every question, dashboard, link and bookmark points at. The only thing a run ever trashes is a
dashboard this tool wrote itself under a layout it no longer writes.

The two auth modes exist because the environments differ in what they may hold. Locally the CLI
completes the setup wizard itself and knows the password. A server's first account is made by a
person, and nothing may store their password, so it uses an api key created under
Admin > Settings > Authentication > API keys. `verifyApiKey()` checks it belongs to an admin before
anything is written, so a revoked key fails up front instead of halfway through the report.

It deliberately depends on no part of the backend, not even in its tests: the schema the cards query
is owned by `@stamhoofd/backend-statistics-syncer`, and reaching for it here would make a shared
package depend on an app. So the tests check the shape of the report — its tabs, cards, parameters
and filters — and never run a card. A column renamed in the statistics migrations therefore surfaces
in Metabase rather than here.

```bash
yarn stam test metabase
```
