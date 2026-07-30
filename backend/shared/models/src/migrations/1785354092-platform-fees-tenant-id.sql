ALTER TABLE `platform` ADD COLUMN `feesTenantId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER `parentTenantId`;
