# Metabase

Everything that configures Metabase: the ledenstatistieken report and the API client that writes it.

| | |
|---|---|
| `report/*.sql` | The report, one file per tab, as queries on the platform statistics database |
| `src/report.ts` | Reads those files. Knows nothing about Metabase |
| `src/api.ts` | Minimal client for the Metabase HTTP API |
| `src/sync-report.ts` | Says the report in Metabase's vocabulary and writes it |
| `src/naming.ts` | What things are called in Metabase, so every caller agrees |

## What the report counts

Two fragments decide that, and every card opens with the pair:

| | |
|---|---|
| `includes/facts.sql` | one row per registration: who was registered where, in which tak, in which year |
| `includes/leden.sql` | that narrowed to one row per member per eenheid, carrying what they are |

The ledenstatistieken count members, not registrations, so every card of that dashboard reads `leden`
and none reads `facts` directly. Someone registered in two takken of the same eenheid stands twice in
`facts`, and counted there they land in two bars of the same chart, or -- if they are leiding in one
tak and lid in the other -- on both sides of the omkaderingscijfer at once. `leden` picks the one
registration that speaks for them: leiding beats lid, and the oldest tak wins between two.

The aanlevering is the exception and keeps reading its own rows. The department counts inschrijvingen
rather than inschrijvers, and reads what a member is from the cancelled registrations as well, so
`jeugdbewegingen.sql` decides it in its own `deelnemers`.

Which registrations reach either of those is the "Ingeschreven voor" filter, in
`includes/ingeschreven-voor.sql`: a registration stands in a leeftijdsgroep, an activiteit or a
wachtlijst, and only the first of the three is being a lid of the eenheid. It is the one filter that
opens on a value -- the leeftijdsgroepen -- because empty counts every registration, which would put
the people waiting for a place among the leden. The aanlevering is not offered it and pins itself to
the leeftijdsgroepen: an unconnected filter counts everything, which is the wrong way for a sheet
delivered to a department to fail.

## One report, several platforms

The same report is written for every platform, and they do not all count every figure the same way:
the GTP index weighs takken for keeo and the age of a lid for ravot, where leiding count as one and a
half. A statistics database holds one platform, so which variant a card gets is decided while the
report is loaded — `loadReport(env)` takes the environment, the same name the data source carries.

| | |
|---|---|
| `report/includes/<env>/gtp.sql` | what `@include gtp` expands to in that environment |
| `-- description@ravot:` | what a card's `-- description:` says there |

A card names neither and keeps saying `@include gtp`, which is what keeps one report from quietly
becoming two. An override of a name no fragment carries is refused rather than ignored: nothing
includes it, so a misspelled file would change nothing and say nothing.

## What a tak counts as

Kinderen, leiding or volwassenen. Every figure that divides the one from the other reads it, and it
is the one thing about a tak that nothing in the administration knows: the platform configuration has
no such field, and the ages do not answer it, since leiding and stam carry no age range and a tak of
kinderen need not carry one either.

`includes/takken.sql` is where it is settled, and `includes/tak-categorie.sql` is the answer itself.
Unqualified, that reads the `category` column the statistics database keeps on `default_age_groups`,
which is filled in by hand. `includes/keeo/tak-categorie.sql` instead names keeo's takken by id and
leaves the column behind it as the fallback, so a tak it does not name — the years imported from the
client's own statistics, most of all — keeps whatever was set for it.

Naming them in the query is what keeps the answer readable. The column survives no rebuild of the
statistics database, and the UPDATE that fills it again is written down nowhere; a list in the query
is in git, is checked by the tests, and stands in front of whoever opens the question in Metabase.
That last part only holds until the next `yarn metabase report`, which rewrites every card from these
files — an edit made in Metabase is a correction to bring back here, not a place to keep one.

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
