ALTER TABLE `member_platform_memberships` DROP FOREIGN KEY `member_platform_memberships_ibfk_4`;
ALTER TABLE `member_platform_memberships`
CHANGE `invoiceItemDetailId` `balanceItemId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '',
DROP COLUMN `invoiceId`;
