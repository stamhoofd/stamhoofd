CREATE TABLE `platform` (
  `id` varchar(36) NOT NULL DEFAULT '',
  `privateConfig` json NOT NULL,
  `config` json NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;