ALTER TABLE `audit_logs`
CHANGE `externalId` `externalId` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
CHANGE `objectId` `objectId` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL;