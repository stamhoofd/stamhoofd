ALTER TABLE `members`
ADD COLUMN `memberNumber` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL;
ADD UNIQUE INDEX `memberNumber` (`memberNumber`) USING BTREE;
