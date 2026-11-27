# Statistics syncer

Keeps the platform statistics database up to date: the separate, de-identified database that Metabase
reports on. It runs the nightly sync from the main administration.

It is deliberately its own service. The sync incrementally reads changed administration records,
with a five-minute overlap, awaited batches of 500 writes and deletion reconciliation. The cron
scheduler has no distributed lock, so running it inside the API would duplicate the sync per API
instance. It runs on a replica server and pushes to a separate statistics
database, so it holds two connections: `STAMHOOFD.stamhoofdDatabase` for the
administration it reads, `STAMHOOFD.statisticsDatabase` for the schema it writes.

It owns the schema it writes into: `src/migrations/` holds the migrations of the statistics database,
`src/schema.ts` runs them and `src/database.ts` connects to it. That database keeps a migration
history of its own, in its own `migrations` table, so it can be moved to another server without
dragging the main one along.

## Remote statistics connections

Remote connections require `DB_CA`. Existing destinations default to mutual TLS and
also require `DB_CERT` and `DB_KEY`. Managed services that do not accept the legacy
client CA must explicitly set `DB_TLS_MODE: 'server'` and `DB_TLS_SERVER_NAME` to the
operator-verified DNS name on the certificate. Both modes can set that name; it
enables mysql2 endpoint verification. `DB_HOST` remains the numeric private route,
and `DB_PORT` must come from the managed endpoint rather than an assumed default.
TCP never resolves the identity hostname when a separate TLS identity is provided.

Do not guess the certificate identity: inspect the actual primary certificate and
CA before cutover; see [database TLS support](../../../packages/node/database/README.md#remote-tls).
Server-only mode explicitly suppresses inherited `DB_CERT`/`DB_KEY` credentials.
This configuration does not provision connectivity, users or grants. External
infrastructure owns those; legacy DevOps only supplies configuration/trust files
to the existing Hetzner syncer. Source administration reads remain local.

The report read off the schema lives in `@stamhoofd/metabase`. It depends on nothing here: it is a
shared package, so the dependency could only run the wrong way.

## Running

```bash
pnpm run start        # boot the service
pnpm run migrations   # migrate the statistics database (part of `pnpm stam db migrate` from the repo root)
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
