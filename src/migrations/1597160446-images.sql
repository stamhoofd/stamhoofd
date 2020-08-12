CREATE TABLE `images` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `source` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `resolutions` json NOT NULL DEFAULT (json_array()),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;