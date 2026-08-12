# Statistics syncer

Keeps the platform statistics database up to date: the separate, de-identified database that Metabase
reports on. It runs the nightly sync from the main administration.

It is deliberately its own service. The sync reads the whole administration in one pass, and the cron
scheduler has no distributed lock, so running it inside the API would mean one full pass per API
instance, competing with request handling. It runs on a replica server and pushes to the statistics
database on the Metabase server, so it holds two connections: `STAMHOOFD.stamhoofdDatabase` for the
administration it reads, `STAMHOOFD.statisticsDatabase` for the schema it writes.

The schema it writes into belongs to `@stamhoofd/statistics-db`, and the report read off it to
`@stamhoofd/metabase`. This package is the only writer of that schema, which is why the two live
apart: the reports are read by a tool that never runs here.

## Running

```bash
yarn start        # boot the service
yarn migrations   # migrate the statistics database (part of `yarn migrate` from the repo root)
```

Wherever this service runs, it syncs: there is nothing to switch off in configuration, so deploy it
only for a platform that has statistics to report on. In development it runs on every cron tick;
elsewhere once a night between 03:00 and 05:00 (see `src/crons.ts`).

`STAMHOOFD.IMPORTED_UNTIL` marks how far back the numbers come from an external import instead of from
this administration; periods ending before it are frozen and left to that import.
