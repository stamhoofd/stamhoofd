ALTER TABLE `settlements` ADD COLUMN `uncollectibleFees` bigint NOT NULL DEFAULT '0' AFTER `pendingFees`;
