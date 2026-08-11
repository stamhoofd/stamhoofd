# Statistics database

The schema of the platform statistics database: the separate, de-identified database Metabase reports
on. Owns its migrations, the connection to it and the rule that it can never be the main database.

It keeps a migration history of its own, in its own `migrations` table, so the database can be moved
to another server without dragging the main one along.

Two packages read this:

- `@stamhoofd/backend-statistics` — the service that writes into the schema every night.
- `@stamhoofd/metabase` — the report queries, whose tests run against the schema this creates.

The migrations are run by the statistics service (`yarn --cwd backend/app/statistics migrations`,
part of `yarn migrate` from the repo root), the same way the API runs the migrations of
`@stamhoofd/models`.
