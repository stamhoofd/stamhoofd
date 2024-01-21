SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT;
SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS;
SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION;
SET NAMES utf8mb4;
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0;

CREATE TABLE `_members_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `membersId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `usersId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `membersId` (`membersId`),
  KEY `usersId` (`usersId`),
  CONSTRAINT `_members_users_ibfk_1` FOREIGN KEY (`membersId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_members_users_ibfk_2` FOREIGN KEY (`usersId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=140735 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `balance_item_payments` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `balanceItemId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `price` int NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  KEY `balanceItemId` (`balanceItemId`),
  KEY `paymentId` (`paymentId`),
  CONSTRAINT `balance_item_payments_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `balance_item_payments_ibfk_2` FOREIGN KEY (`balanceItemId`) REFERENCES `balance_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `balance_item_payments_ibfk_3` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `balance_items` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `registrationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `memberId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `orderId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `price` int NOT NULL,
  `pricePaid` int NOT NULL,
  `status` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  KEY `registrationId` (`registrationId`),
  KEY `userId` (`userId`),
  KEY `memberId` (`memberId`),
  KEY `orderId` (`orderId`),
  CONSTRAINT `balance_items_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `balance_items_ibfk_2` FOREIGN KEY (`registrationId`) REFERENCES `registrations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `balance_items_ibfk_3` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `balance_items_ibfk_4` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `balance_items_ibfk_5` FOREIGN KEY (`orderId`) REFERENCES `webshop_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `buckaroo_payments` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'ascii_general_ci',
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `transactionKey` varchar(54) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentId` (`paymentId`) USING BTREE,
  CONSTRAINT `buckaroo_payments_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `challenges` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `challenge` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `expiresAt` datetime NOT NULL,
  `authSignKeyConstants` json DEFAULT NULL,
  `tries` int unsigned NOT NULL DEFAULT '0',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `email` (`email`,`organizationId`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `challenges_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=63629 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cities` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `country` varchar(2) DEFAULT NULL,
  `parentCityId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `provinceId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `provinceId` (`provinceId`),
  KEY `parentCityId` (`parentCityId`),
  FULLTEXT KEY `name` (`name`),
  CONSTRAINT `cities_ibfk_1` FOREIGN KEY (`provinceId`) REFERENCES `provinces` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cities_ibfk_2` FOREIGN KEY (`parentCityId`) REFERENCES `cities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `document_templates` (
  `id` varchar(36) NOT NULL DEFAULT '',
  `html` longtext NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `status` varchar(36) NOT NULL,
  `settings` json NOT NULL,
  `privateSettings` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `updatesEnabled` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `document_templates_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `documents` (
  `id` varchar(36) NOT NULL DEFAULT '',
  `data` json NOT NULL,
  `status` varchar(36) NOT NULL,
  `templateId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `registrationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `memberId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `number` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `templateId` (`templateId`),
  KEY `registrationId` (`registrationId`),
  KEY `memberId` (`memberId`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`templateId`) REFERENCES `document_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `documents_ibfk_2` FOREIGN KEY (`registrationId`) REFERENCES `registrations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `documents_ibfk_3` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `email_templates` (
  `id` varchar(36) NOT NULL DEFAULT '',
  `subject` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `groupId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `webshopId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `html` text NOT NULL,
  `json` json NOT NULL,
  `updatedAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  KEY `webshopId` (`webshopId`),
  KEY `groupId` (`groupId`),
  CONSTRAINT `email_templates_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `email_templates_ibfk_2` FOREIGN KEY (`webshopId`) REFERENCES `webshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `email_templates_ibfk_3` FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `email_verification_codes` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email` varchar(255) NOT NULL,
  `code` varchar(20) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `token` varchar(256) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `expiresAt` datetime NOT NULL,
  `generatedCount` int unsigned NOT NULL DEFAULT '0',
  `tries` int unsigned NOT NULL DEFAULT '0',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `userId` (`userId`) USING BTREE,
  UNIQUE KEY `token` (`token`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `email_verification_codes_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `email_verification_codes_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `groups` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `settings` json NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `cycle` int NOT NULL DEFAULT '0' COMMENT 'Increased every time a new registration period started',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `privateSettings` json NOT NULL DEFAULT (json_object()),
  `deletedAt` datetime DEFAULT NULL,
  `status` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Open',
  PRIMARY KEY (`id`),
  UNIQUE KEY `groupCycle` (`cycle`,`id`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `images` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `source` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `resolutions` json NOT NULL DEFAULT (json_array()),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `invites` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `key` varchar(128) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'Key needed to access the invite data',
  `keychainItems` text CHARACTER SET ascii COLLATE ascii_general_ci COMMENT 'Encrypted keychain data that is shared with this user',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `senderId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `receiverId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `permissions` json DEFAULT NULL COMMENT 'Only set when you going to give admin permissions',
  `memberIds` json DEFAULT NULL COMMENT 'Set when you are going to give permissions to access members',
  `userDetails` json DEFAULT NULL COMMENT 'Auto prefill user information (email, name, ...) when creating the user',
  `validUntil` datetime NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`) USING BTREE,
  KEY `receiverId` (`receiverId`),
  KEY `senderId` (`senderId`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `invites_ibfk_1` FOREIGN KEY (`receiverId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invites_ibfk_2` FOREIGN KEY (`senderId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invites_ibfk_3` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `keychain` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `publicKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL COMMENT 'The public key a user has received access to',
  `encryptedPrivateKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL COMMENT 'The private key associated with this public key, encrypted with the private key of the user',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `publicKeyPerUser` (`publicKey`,`userId`) USING BTREE,
  KEY `userId` (`userId`),
  CONSTRAINT `keychain_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `members` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `firstName` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `birthDay` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `details` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `outstandingBalance` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `members_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mollie_payments` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'ascii_general_ci',
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `mollieId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentId` (`paymentId`) USING BTREE,
  CONSTRAINT `mollie_payments_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `mollie_tokens` (
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `accessToken` text,
  `refreshToken` text,
  `createdAt` datetime NOT NULL,
  `expiresOn` datetime DEFAULT NULL,
  PRIMARY KEY (`organizationId`),
  UNIQUE KEY `organizationId` (`organizationId`),
  CONSTRAINT `mollie_tokens_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `organizations` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `uri` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `registerDomain` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `publicKey` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` json NOT NULL,
  `searchIndex` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `privateMeta` json NOT NULL DEFAULT (json_object()),
  `serverMeta` json NOT NULL DEFAULT (json_object()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uri` (`uri`) USING BTREE,
  UNIQUE KEY `registerDomain` (`registerDomain`) USING BTREE,
  FULLTEXT KEY `searchIndex` (`searchIndex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_tokens` (
  `token` varchar(256) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `validUntil` datetime NOT NULL,
  `userId` varchar(256) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  PRIMARY KEY (`token`),
  KEY `userId` (`userId`),
  CONSTRAINT `password_tokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payconiq_payments` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'ascii_general_ci',
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `payconiqId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentId` (`paymentId`) USING BTREE,
  CONSTRAINT `payconiq_payments_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `payments` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `settlement` json DEFAULT NULL,
  `iban` varchar(40) DEFAULT NULL,
  `ibanName` varchar(128) DEFAULT NULL,
  `method` varchar(36) DEFAULT NULL,
  `provider` varchar(36) DEFAULT NULL,
  `status` varchar(36) NOT NULL,
  `price` int NOT NULL,
  `transferSettings` json DEFAULT NULL,
  `transferDescription` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `paidAt` datetime DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `freeContribution` int DEFAULT NULL,
  `stripeAccountId` varchar(36) DEFAULT NULL,
  `transferFee` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `createdAt` (`createdAt`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  KEY `userId` (`userId`),
  KEY `stripeAccountId` (`stripeAccountId`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `stripeAccountId` FOREIGN KEY (`stripeAccountId`) REFERENCES `stripe_accounts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `postal_codes` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `postalCode` varchar(36) NOT NULL,
  `cityId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `country` varchar(2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `postalCode` (`postalCode`,`country`) USING BTREE,
  KEY `cityId` (`cityId`),
  CONSTRAINT `postal_codes_ibfk_1` FOREIGN KEY (`cityId`) REFERENCES `cities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `provinces` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` varchar(50) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `country` varchar(2) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  FULLTEXT KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `register_codes` (
  `code` varchar(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'utf8mb4_unicode_ci',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `value` int NOT NULL DEFAULT '0',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `description` varchar(100) NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `registrations` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `memberId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `groupId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `reservedUntil` datetime DEFAULT NULL,
  `registeredAt` datetime DEFAULT NULL COMMENT 'Date of the registration or renewal. This is null if the registration is not yet active (e.g. during payment)',
  `deactivatedAt` datetime DEFAULT NULL COMMENT 'Set if the registration was canceled or deactivated during the group cycle. Keep this null at the end of the group cycle.',
  `cycle` int NOT NULL COMMENT 'Cycle of the group the registration is for',
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `price` int DEFAULT NULL,
  `waitingList` tinyint(1) NOT NULL DEFAULT '0',
  `canRegister` tinyint(1) NOT NULL DEFAULT '0',
  `pricePaid` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `groupCycleMember` (`groupId`,`cycle`,`memberId`) USING BTREE,
  KEY `memberId` (`memberId`) USING BTREE,
  KEY `paymentId` (`paymentId`),
  KEY `groupOccupancy` (`groupId`,`cycle`,`registeredAt`,`reservedUntil`) USING BTREE,
  CONSTRAINT `registrations_ibfk_1` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registrations_ibfk_2` FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registrations_ibfk_3` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `stamhoofd_credits` (
  `id` varchar(36) NOT NULL DEFAULT 'utf8mb4_0900_ai_ci',
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ascii_general_ci',
  `expireAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `description` varchar(255) NOT NULL,
  `allowTransactions` int NOT NULL DEFAULT '0',
  `change` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`,`createdAt`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `stamhoofd_invoices` (
  `id` varchar(36) NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `creditId` varchar(36) DEFAULT NULL,
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `meta` json NOT NULL,
  `reference` varchar(128) DEFAULT NULL,
  `number` mediumint DEFAULT NULL,
  `paidAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  KEY `paymentId` (`paymentId`),
  KEY `reference` (`reference`) USING BTREE,
  CONSTRAINT `stamhoofd_invoices_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `stamhoofd_invoices_ibfk_2` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `stamhoofd_packages` (
  `id` varchar(36) NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `meta` json NOT NULL,
  `removeAt` datetime DEFAULT NULL,
  `validUntil` datetime DEFAULT NULL,
  `validAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `emailCount` int NOT NULL DEFAULT '0',
  `lastEmailAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `stamhoofd_pending_invoices` (
  `id` varchar(36) NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `meta` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `invoiceId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizationId` (`organizationId`) USING BTREE,
  KEY `invoiceId` (`invoiceId`),
  CONSTRAINT `stamhoofd_pending_invoices_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `stamhoofd_pending_invoices_ibfk_2` FOREIGN KEY (`invoiceId`) REFERENCES `stamhoofd_invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `streets` (
  `id` varchar(36) NOT NULL,
  `cityId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `cityId` (`cityId`),
  CONSTRAINT `streets_ibfk_1` FOREIGN KEY (`cityId`) REFERENCES `cities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `stripe_accounts` (
  `id` varchar(36) NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'ascii_general_ci',
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `accountId` varchar(100) NOT NULL,
  `meta` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `stripe_accounts_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `stripe_checkout_sessions` (
  `id` varchar(36) NOT NULL,
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `stripeSessionId` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `organizationId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripeIntentId` (`stripeSessionId`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `stripe_payment_intents` (
  `id` varchar(36) NOT NULL,
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `stripeIntentId` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `organizationId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripeIntentId` (`stripeIntentId`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tokens` (
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `accessToken` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `refreshToken` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessTokenValidUntil` datetime NOT NULL,
  `refreshTokenValidUntil` datetime NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`accessToken`),
  UNIQUE KEY `refreshToken` (`refreshToken`),
  KEY `userId` (`userId`),
  CONSTRAINT `tokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `used_register_codes` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `code` varchar(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'utf8mb4_unicode_ci',
  `creditId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizationId` (`organizationId`) USING BTREE,
  KEY `creditId` (`creditId`),
  KEY `code` (`code`),
  CONSTRAINT `used_register_codes_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `used_register_codes_ibfk_2` FOREIGN KEY (`creditId`) REFERENCES `stamhoofd_credits` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `used_register_codes_ibfk_3` FOREIGN KEY (`code`) REFERENCES `register_codes` (`code`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `firstName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `requestKeys` tinyint(1) NOT NULL DEFAULT '0',
  `publicKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `publicAuthSignKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `permissions` json DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `authSignKeyConstants` json DEFAULT NULL,
  `authEncryptionKeyConstants` json DEFAULT NULL,
  `encryptedPrivateKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `emailOrganizaton` (`email`,`organizationId`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `webshop_orders` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `data` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `webshopId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `validAt` datetime DEFAULT NULL,
  `number` bigint unsigned DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `status` varchar(36) NOT NULL DEFAULT 'Created',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `orderNumber` (`number`,`webshopId`) USING BTREE,
  UNIQUE KEY `orderNumberForWebshop` (`webshopId`,`number`) USING BTREE,
  UNIQUE KEY `updatedAt` (`webshopId`,`updatedAt`,`number`) USING BTREE,
  KEY `paymentId` (`paymentId`),
  KEY `webshopId` (`webshopId`),
  KEY `organizationId` (`organizationId`),
  KEY `userId` (`userId`),
  CONSTRAINT `webshop_orders_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `webshop_orders_ibfk_2` FOREIGN KEY (`webshopId`) REFERENCES `webshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `webshop_orders_ibfk_3` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `webshop_orders_ibfk_4` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `webshop_tickets` (
  `id` varchar(36) NOT NULL,
  `secret` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `itemId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `orderId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `webshopId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `scannedAt` datetime DEFAULT NULL,
  `scannedBy` varchar(100) DEFAULT NULL,
  `index` int NOT NULL,
  `seat` json DEFAULT NULL,
  `originalSeat` json DEFAULT NULL,
  `total` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `secret` (`secret`,`webshopId`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  KEY `orderId` (`orderId`),
  KEY `updatedAt` (`webshopId`,`updatedAt`) USING BTREE,
  CONSTRAINT `webshop_tickets_ibfk_1` FOREIGN KEY (`webshopId`) REFERENCES `webshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `webshop_tickets_ibfk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `webshop_tickets_ibfk_3` FOREIGN KEY (`orderId`) REFERENCES `webshop_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `webshops` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `products` json NOT NULL,
  `categories` json NOT NULL,
  `uri` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `legacyUri` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `domain` varchar(100) DEFAULT NULL,
  `meta` json NOT NULL,
  `privateMeta` json NOT NULL DEFAULT (json_object()),
  `serverMeta` json NOT NULL DEFAULT (json_object()),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `domainUri` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uri` (`uri`) USING BTREE,
  UNIQUE KEY `domain` (`domain`,`domainUri`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `webshops_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET SQL_MODE=@OLD_SQL_MODE ;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS ;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS ;
SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT ;
SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS ;
SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION ;
SET SQL_NOTES=@OLD_SQL_NOTES ;