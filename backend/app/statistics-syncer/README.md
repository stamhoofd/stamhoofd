# Statistics syncer

Keeps the platform statistics database up to date: the separate, de-identified database that Metabase
reports on. It runs the nightly sync from the main administration.

It is deliberately its own service. The sync reads the whole administration in one pass, and the cron
scheduler has no distributed lock, so running it inside the API would mean one full pass per API
instance, competing with request handling. It runs on a replica server and pushes to the statistics
database on the Metabase server, so it holds two connections: `STAMHOOFD.stamhoofdDatabase` for the
administration it reads, `STAMHOOFD.statisticsDatabase` for the schema it writes.

It owns the schema it writes into: `src/migrations/` holds the migrations of the statistics database,
`src/schema.ts` runs them and `src/database.ts` connects to it. That database keeps a migration
history of its own, in its own `migrations` table, so it can be moved to another server without
dragging the main one along.

The report read off the schema lives in `@stamhoofd/metabase`. It depends on nothing here: it is a
shared package, so the dependency could only run the wrong way.

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

A period the administration has locked stops being synced as well, one run later: the run that first
sees the lock still writes the changes and the deletions of that day, and settles the period at the
end if it came through in full. Unlocking a period brings it back into the sync, unless it ended more
than a year ago.
