CREATE TABLE `vies_cached_results` (
    `VATNumber` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    `checkedAt` datetime NOT NULL,
    `result` tinyint(1) NOT NULL,
    PRIMARY KEY (`VATNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
