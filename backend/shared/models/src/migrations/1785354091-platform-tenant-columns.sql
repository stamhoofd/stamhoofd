ALTER TABLE `platform` ADD COLUMN `parentTenantId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER `id`;
ALTER TABLE `platform` ADD COLUMN `feesTenantId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER `parentTenantId`;
ALTER TABLE `platform` ADD COLUMN `uri` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER `feesTenantId`;
ALTER TABLE `platform` ADD COLUMN `domain` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER `uri`;
ALTER TABLE `platform` ADD UNIQUE KEY `uri` (`uri`);
ALTER TABLE `platform` ADD UNIQUE KEY `domain` (`domain`);
ALTER TABLE `platform` ADD KEY `parentTenantId` (`parentTenantId`);
