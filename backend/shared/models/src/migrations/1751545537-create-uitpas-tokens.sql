CREATE TABLE `uitpas_tokens` (
   `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
   `clientId` varchar(255) NOT NULL,
   `clientSecret` varchar(255) NOT NULL,
   `createdAt` date NOT NULL,
   `organizationId` varchar(36),
   PRIMARY KEY (id),
   UNIQUE KEY `organizationId` (`organizationId`)
);
