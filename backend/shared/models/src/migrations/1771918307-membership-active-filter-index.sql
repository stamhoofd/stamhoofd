CREATE INDEX `idx_memberships_lookup` 
ON `member_platform_memberships` (`memberId`, `deletedAt`, `startDate`, `endDate`);
