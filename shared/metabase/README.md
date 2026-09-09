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

Two fragments decide that, and every card opens on one of them:

| | |
|---|---|
| `includes/all-non-platform-registrations.sql` | one row per registration: who was registered where, in which leeftijdsgroep, in which year |
| `includes/deduplicated-non-platform-registrations.sql` | that narrowed to one row per member per eenheid, carrying what they are |

Each fragment is a complete query. It states its own dependencies -- `deduplicated-non-platform-registrations` opens a `WITH` on
`all-non-platform-registrations`, which opens one on `all-registrations` -- so whoever reads one
includes that one and nothing else, names it in a `WITH` (or a derived table) of their own, and never
learns what it is built from. It also means every fragment runs as it stands: paste
`{{snippet: deduplicated-non-platform-registrations}}` into a Metabase question on its own and the leden come back as a table, which is
how a figure is investigated apart from the aggregates the cards draw over it.
`includes/deduplicated-non-platform-registrations-all-years.sql` is the same over every werkjaar at once -- the year filter does not
reach it, which is what the trend cards read; a test keeps its ranking identical to the single-year fragment's.

A fragment that is a condition rather than a query -- which aansluitingen count, which kinds of
registration count -- carries a `filter-` prefix and is a bare predicate: the query that includes it
writes the `AND` or `WHERE` around it, so it fits any place in a where-clause. A fragment says what
it is on a `-- description:` first line, which becomes the snippet's description in Metabase rather
than a comment in its sql.

The ledenstatistieken count members, not registrations, so every card of that dashboard reads `deduplicated-non-platform-registrations`
and none reads the registrations directly. Someone registered in two leeftijdsgroepen of the same eenheid holds
two registrations, and counted there they land in two bars of the same chart, or -- if they are leiding in one
leeftijdsgroep and lid in the other -- on both sides of the omkaderingscijfer at once. That fragment picks the one
registration that speaks for them: a leeftijdsgroep beats an activiteit, one that still stands beats
one that was cancelled, leiding beats lid, and the oldest leeftijdsgroep wins between two. The
leeftijdsgroep comes first because an activiteit says where someone went, not what they are: a lid who
left their leeftijdsgroep in november and joined a kamp afterwards is still counted in the
leeftijdsgroep they were a lid of.

The aanlevering is the exception and keeps reading its own rows. The department counts inschrijvingen
rather than inschrijvers, and reads what a member is from the cancelled registrations as well, so
`jeugdbewegingen.sql` decides it in its own `deelnemers`.

Which registrations reach either of those is `includes/filter-registration-types.sql`: a registration
stands in a leeftijdsgroep, an activiteit or a wachtlijst, and only the first two count as being a
lid -- counting the wachtlijsten would put the people waiting for a place among the leden. The
aanlevering pins itself further to the leeftijdsgroepen alone in `jeugdbewegingen.sql`.

## One definition, in Metabase too

`@include` puts a fragment in one place in git. Snippets put it in one place in Metabase: every
fragment a question refers to is written as a snippet of its own, and a question refers to it -- `{{snippet: deduplicated-non-platform-registrations}}`
where the file says `-- @include deduplicated-non-platform-registrations`, with it referring to
`{{snippet: all-non-platform-registrations}}` rather than holding a second copy of those rows. A card is then the handful of lines that say what it counts
instead of the two hundred that say what a lid is, and whoever changes what a lid is changes it once
for the forty-odd questions that count one -- the questions the client writes themselves included,
which can open on `{{snippet: deduplicated-non-platform-registrations}}` instead of on a copy pasted out of a card.

A question declares a tag for every fragment it reads, the ones it only reaches through another
fragment included: Metabase resolves a nested `{{snippet: all-registrations}}` against the tags of the question
it is running and not against those of the fragment that refers to it, so naming a fragment is not enough
to reach what it reads. A snippet is also pointed at by id, which is why the fragments are
written before the questions that read them.

Nothing here ever clears a fragment away. Metabase cannot delete a snippet, only archive it, and the
name stays taken either way -- so a snippet is matched by name and updated in place, an archived one
is brought back rather than written a second time, and one the report no longer has is left alone,
since whatever has been built on it since would break with it.

The fragments are still expanded as well. `card.sql` is the whole query, which is what the tests read
and what says whether the sql itself is right; `card.snippetSql` is that query with the fragments left
as references, and is what Metabase is given.

`-- @inline <name>` is the other way to read the same file: it is written out where it stands in both,
so Metabase is given the sql rather than a reference, and no snippet is offered for it. It is for a
fragment that exists only so an environment can say a piece of a query its own way -- the kenmerken a
sheet splits its rijen into, the kolomnamen it groups them on -- where a snippet would stand in the
sidebar as a piece of syntax nobody would open, with nothing referring to it. An inlined fragment reads no fragment of its own: written
out, a nested `{{snippet: ...}}` would reach Metabase against tags the question never declared, and
it is refused rather than left to fail there.

## One report, several platforms

The same report is written for every platform, and they do not all count every figure the same way:
the GTP index weighs leeftijdsgroepen for keeo and the age of a lid for ravot, where leiding count as one and a
half. A statistics database holds one platform, so which variant a card gets is decided while the
report is loaded — `loadReport(env)` takes the environment, the same name the data source carries.

| | |
|---|---|
| `report/includes/<env>/gtp.sql` | what `@include gtp` expands to in that environment |
| `-- description@ravot:` | what a card's `-- description:` says there |
| `-- except: keeo` | the tab or card is not written there at all |
| `-- only: keeo` | the card is written there and nowhere else |

A card names the first two and keeps saying `@include gtp`, which is what keeps one report from
quietly becoming two. An override of a name no fragment carries is refused rather than ignored:
nothing includes it, so a misspelled file would change nothing and say nothing.

`except` is the one that leaves something out rather than saying it differently, for the figure a
platform records nothing about. Keeo no longer asks its leden for a geslacht, so the seven cards that
split on one are not written there. A card left alone on a row by this takes the row:
`-- size@keeo: full` on the lidgeldverdeling of the eenheden page and on the
leeftijdsgroepenvergelijking of the nationale page, each of which stood beside a geslachtenverdeling.

Where the figure is worth reading without the split, it is drawn two ways rather than dropped. A card
cannot be two shapes, so it is two cards, and `only` is what keeps them from both being written:

| | drawn everywhere but keeo | drawn there |
|---|---|---|
| de leeftijdsverdeling van een eenheid | `eenheid-leeftijd-en-geslacht` | `eenheid-leden-per-leeftijd` |
| de ULDK-tabel en haar totalen | `uldk`, `uldk-totaal` | `uldk-zonder-geslacht`, `uldk-zonder-geslacht-totaal` |

`except: keeo` on the first and `only: keeo` on the second, which is the whole of the pairing:
`except` on both would hand a platform naming neither of them both shapes of one figure. The ULDK
pair says why that matters — both tables are titled `ULDK`, as the page names them, so a platform
given the two would store them as one question. Two cards of a tab may share a title exactly because
no environment writes both, and that is checked per environment rather than over the file.

The aanlevering follows, and is where this cannot be said with `except`: a sheet is one card, so the
column goes rather than the card. `includes/participant-details.sql` is the kenmerken a
deelnemerstabblad splits its rijen into and `includes/participant-detail-columns.sql` the same ones
as the names it groups and orders on — keeo's variants of the two name the geboortejaar alone. Both
are read by both deelnemerstabbladen, and a test keeps them naming the same kenmerken: a column
selected but not grouped on is a sheet that refuses to run. Both are inlined: what they hold is the
columns of one sheet rather than a definition the report counts by, and neither is read anywhere but
in those two cards.

Not grouping on it is the point rather than a consequence. A werkjaar imported from the client's own
statistics still has the answer on file, so a sheet that kept the column would deliver those years
split into more rows than the years after them. The rows the CTEs are built from still carry the
`Geslacht` — they are the registrations as they stand, and every other page reads them — but nothing
in the sheet reads it.

What an environment leaves out is still read once, by `loadRetiredReport(env)`. A question is stored
in Metabase under its card and its tab, so the questions of a card that stopped being written are
only recognisable from the report that no longer holds it — and without them they would be archived
as something the client wrote themselves, which is to say not at all.

## What a leeftijdsgroep counts as

Kinderen, leiding or volwassenen. Every figure that divides the one from the other reads it, and it
is the one thing about a leeftijdsgroep that nothing in the administration knows: the platform configuration has
no such field, and the ages do not answer it, since leiding and stam carry no age range and a leeftijdsgroep of
kinderen need not carry one either.

`includes/default-age-groups-with-category.sql` is where it is settled, and
`includes/default-age-group-category.sql` is the answer itself. `includes/keeo/` and
`includes/ravot/` hold the lists that name that platform's leeftijdsgroepen by id; the unqualified fragment
says nothing, which is what a platform that has not written its list is left with.

The statistics database used to hold a hand-filled `category` column for this instead. It is dropped:
a column no rebuild survives, refilled by an UPDATE recorded nowhere, is not somewhere an answer can
live. A list in the query is in git, is checked by the tests, and stands in front of whoever opens
the question in Metabase. The cost is that it is now the whole answer — a leeftijdsgroep missing from its
platform's list counts as nothing at all, so a leeftijdsgroep added to the platform configuration has to be
added here too.

Ravot's list is the one to read before changing either. Its ondersteunende leden are volwassenen and
may not be categorised as leiding: the omkaderingscijfer and the GTP index would then count them as
leiding the kinderen of an eenheid are looked after by. The aanlevering delivers them among the
leiding anyway — the department has no third word for them — by naming the leeftijdsgroep itself in
`ravot/participant-type.sql`, which only works for as long as the category does not say it. Keeo
names two there: its stam is delivered among the leden and its ondersteunende leden among the
leiding, and both stay volwassenen everywhere else.

Standing in front of the reader only holds until the next `yarn metabase report`, which rewrites every
card from these files — an edit made in Metabase is a correction to bring back here, not a place to
keep one.

One tab is not part of the client's own report. `report/jeugdbewegingen.sql` is the dataset the
koepel delivers to the Departement Cultuur, Jeugd en Media every september, one card per sheet of the
delivery template: tables to download as .xlsx and paste into it rather than charts to read. It names
a `dashboard:` of its own, which writes it as a second dashboard in the collection instead of as a
page of the ledenstatistieken. That is also why those cards name their columns -- Metabase writes the
header of an export from the column's title, and a sheet read by a government department has to keep
the names the template gives it. A figure the koepel wants out of the same sheet for itself stands
behind those, in a column the template has no cell for: keeo reads how many of a row are the stam
and the ondersteunende leden it delivers among the leden and the leiding.

The koepel's own organization is treated the other way around by the two. The ledenstatistieken leave
it out by default -- it is the national body, not an eenheid, and the client's own report normally
counts none of its structuurvrijwilligers -- but expose a boolean dashboard filter to include it.
The aanlevering is about nothing else.
`platform.membershipOrganizationId` is the only thing that says which organization that is, so the
same rows exist as two fragments: `includes/all-registrations.sql` with the koepel, and
`includes/all-non-platform-registrations.sql` -- those rows less the koepel unless the dashboard
filter includes it -- built on top of it.
The import writes the
koepel under that same id, so both hold in the years imported from the client's own statistics as
well as in the years the sync owns.

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
