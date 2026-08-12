# Statistics database

The schema of the platform statistics database: the separate, de-identified database Metabase reports
on. Owns its migrations, the connection to it and the rule that it can never be the main database.

It keeps a migration history of its own, in its own `migrations` table, and takes its full connection
details from `STAMHOOFD.statisticsDatabase`: the database lives on the Metabase server, not on the one
the syncer runs on. `DB_PORT` may be left out — it then follows the main database while both are on
the same host, which is what lets development and tests keep them on one MySQL, and is 3306 on any
other host.

Two packages read this:

- `@stamhoofd/backend-statistics-syncer` — the service that writes into the schema every night.
- `@stamhoofd/metabase` — the report queries, whose tests run against the schema this creates.

The migrations are run by the syncer (`yarn --cwd backend/app/statistics-syncer migrations`, part of
`yarn migrate` from the repo root), the same way the API runs the migrations of `@stamhoofd/models`.
