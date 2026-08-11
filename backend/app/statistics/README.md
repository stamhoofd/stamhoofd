# Statistics

Keeps the platform statistics database up to date: the separate, de-identified database that Metabase
reports on. It runs the nightly sync from the main administration and owns the migrations of that
database.

It is deliberately its own service. The sync reads the whole administration in one pass, and the cron
scheduler has no distributed lock, so running it inside the API would mean one full pass per API
instance, competing with request handling.

The schema, the sync itself and the report queries live in `backend/shared/statistics`, which the CLI
also reads for `stam metabase report`.

## Running

```bash
yarn start        # boot the service
yarn migrations   # migrate the statistics database (part of `yarn migrate` from the repo root)
```

The sync only runs when `DB_STATISTICS_DATABASE` is configured, on a platform it was rolled out to
(see `src/crons.ts`). In development it runs on every cron tick; elsewhere once a night between 03:00
and 05:00.
