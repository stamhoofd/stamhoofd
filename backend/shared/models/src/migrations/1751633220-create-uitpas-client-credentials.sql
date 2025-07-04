CREATE TABLE `uitpas_client_credentials` (
   `id` varchar(36) NOT NULL,
   `clientId` varchar(255) NOT NULL,
   `clientSecret` varchar(255) NOT NULL,
   `createdAt` date NOT NULL,
   `updatedAt` datetime NOT NULL,
   `organizationId` varchar(36),
   PRIMARY KEY (id),
   UNIQUE KEY `organizationId` (`organizationId`),
   CONSTRAINT `fk_uitpas_client_credentials_organization` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
