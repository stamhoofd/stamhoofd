ALTER TABLE `audit_logs`
ADD COLUMN `source` varchar(36) NOT NULL AFTER `id`;
