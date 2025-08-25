ALTER TABLE `emails`
ADD COLUMN `spamComplaintsCount` int NOT NULL DEFAULT '0' AFTER `softFailedCount`,
ADD COLUMN `softBouncesCount` int NOT NULL DEFAULT '0' AFTER `softFailedCount`,
ADD COLUMN `hardBouncesCount` int NOT NULL DEFAULT '0' AFTER `softFailedCount`;
