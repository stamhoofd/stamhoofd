ALTER TABLE `data_retention_runs` ADD COLUMN `delayReportedAt` datetime DEFAULT NULL, ALGORITHM=INSTANT;
