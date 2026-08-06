-- Bookkeeping for the sync job. One row per synced table, so every table advances on its own and a
-- table that fails keeps retrying from where it got to without holding up the others.
--
-- `watermark` is the highest `updatedAt` of the source rows that made it in. The next run reads from
-- slightly before it (see the overlap in the sync), which is what makes a crashed or half-finished
-- run harmless: rows are written again rather than skipped.
CREATE TABLE `stats_sync_state` (
  `tableName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `watermark` datetime DEFAULT NULL COMMENT 'Highest updatedAt of the source rows synced so far. Null means nothing was synced yet, which is also how a full backfill starts.',
  `lastSucceededAt` datetime DEFAULT NULL COMMENT 'End of the last incremental run that completed without an error',
  `lastReconciledAt` datetime DEFAULT NULL COMMENT 'End of the last run that reconciled deletes against the source table',
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`tableName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
