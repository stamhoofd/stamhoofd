ALTER TABLE `member_platform_memberships`
ADD COLUMN `expireDate` datetime NULL AFTER `endDate`;
