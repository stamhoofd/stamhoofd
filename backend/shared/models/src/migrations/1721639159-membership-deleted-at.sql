ALTER TABLE `member_platform_memberships`
ADD COLUMN `deletedAt` datetime NULL AFTER `createdAt`;
