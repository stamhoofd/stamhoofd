-- The platform statistics database: a de-identified copy of the member administration that Metabase
-- reports on. Rows are kept at their source grain and every figure is aggregated at query time, so
-- the tables mirror the main database: same table names, same column names, same column types.
--
-- What is left out is everything that identifies a natural person. `members` carries no name, no
-- contact details and no date of birth, only the birth year; every json column of the source is
-- dropped, since `details` and `recordAnswers` hold exactly the personal data this database must not
-- contain. Keep that property when adding tables here: the point of a separate database is that it
-- can be handed to a reporting tool that must never reach the main one.
--
-- Two columns are not copies of anything in the source:
--
--   * `source` says which pipeline wrote a row. The nightly reconciliation checks rows against the
--     main database, and rows that came from an import have no counterpart there — without this it
--     would delete every one of them on the first night.
--   * `registration_periods`.`cutoffAt` freezes a period. Once it has passed, the sync stops writing
--     anything belonging to that period, so the numbers for that year are settled and later changes
--     in the administration no longer move them. It is per period because the boundary differs per
--     platform and per year, and it is what makes room for data imported from a client's own
--     statistics database: those years are frozen, so nothing overwrites them.

CREATE TABLE `registration_periods` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `startDate` datetime NOT NULL,
  `endDate` datetime NOT NULL,
  `locked` tinyint NOT NULL DEFAULT '0',
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `previousPeriodId` varchar(36) DEFAULT NULL,
  `nextPeriodId` varchar(36) DEFAULT NULL,
  `customName` varchar(200) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `source` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sync' COMMENT 'Which pipeline produced this row: sync or import',
  `cutoffAt` datetime DEFAULT NULL COMMENT 'From when this period is frozen: the sync stops writing rows belonging to it. Null means it is still live.',
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  KEY `previousPeriodId` (`previousPeriodId`),
  KEY `startDate` (`startDate`),
  KEY `source` (`source`),
  KEY `cutoffAt` (`cutoffAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- An organization is a legal entity, not a natural person, so its name and where it is are not
-- personal data. `postalCode` and `city` are flattened out of the source `address` json: the report
-- maps units by postal code and lists them by city. The rest of the address is left behind.
CREATE TABLE `organizations` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `uri` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `postalCode` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `periodId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `source` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sync' COMMENT 'Which pipeline produced this row: sync or import',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uri` (`uri`) USING BTREE,
  KEY `periodId` (`periodId`),
  KEY `name` (`name`),
  KEY `postalCode` (`postalCode`),
  KEY `city` (`city`),
  KEY `source` (`source`),
  CONSTRAINT `organizations_ibfk_1` FOREIGN KEY (`periodId`) REFERENCES `registration_periods` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Platform configuration that lives in json on the platform record in the main database. It is
-- flattened into tables here so Metabase can join and group on it.
CREATE TABLE `organization_tags` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Which netwerk an organization belongs to, per period. The source only knows the tags it carries
-- now, so the sync records them against the period the organization is in; a settled year keeps the
-- netwerk it was recorded with while it was live, instead of moving along with the organization.
CREATE TABLE `_organizations_organization_tags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organizationsId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `organizationTagsId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `periodId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `source` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sync' COMMENT 'Which pipeline produced this row: sync or import',
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizationsId,organizationTagsId,periodId` (`organizationsId`,`organizationTagsId`,`periodId`) USING BTREE,
  KEY `organizationTagsId` (`organizationTagsId`),
  KEY `periodId` (`periodId`),
  KEY `source` (`source`),
  CONSTRAINT `_organizations_organization_tags_ibfk_1` FOREIGN KEY (`organizationsId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_organizations_organization_tags_ibfk_2` FOREIGN KEY (`organizationTagsId`) REFERENCES `organization_tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_organizations_organization_tags_ibfk_3` FOREIGN KEY (`periodId`) REFERENCES `registration_periods` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The takken every organization's groups map onto.
CREATE TABLE `default_age_groups` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `minAge` int DEFAULT NULL,
  `maxAge` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `minAge` (`minAge`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `platform_membership_types` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Which functie a member holds. This is what separates leiding from the members they lead.
CREATE TABLE `responsibilities` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- `name` is flattened out of the source `settings` json, which also holds descriptions and prices
-- that the reports have no use for.
CREATE TABLE `groups` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `type` varchar(36) NOT NULL DEFAULT 'Membership',
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `periodId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `defaultAgeGroupId` varchar(36) DEFAULT NULL,
  `cycle` int NOT NULL DEFAULT '0',
  `status` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Open',
  `deletedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `source` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sync' COMMENT 'Which pipeline produced this row: sync or import',
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  KEY `periodId` (`periodId`),
  KEY `defaultAgeGroupId` (`defaultAgeGroupId`),
  KEY `source` (`source`),
  CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `groups_ibfk_2` FOREIGN KEY (`periodId`) REFERENCES `registration_periods` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `groups_ibfk_3` FOREIGN KEY (`defaultAgeGroupId`) REFERENCES `default_age_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per member, carrying only what the reports group by. `birthYear` replaces the source
-- `birthDay`: age distributions need the year, and a full date of birth is personal data.
--
-- `postalCode` is the one field here that describes a natural person, kept because the report maps
-- members by postal code and nothing coarser draws that map. It is the sharpest thing in this
-- database: together with the unit and tak a registration already gives, plus a birth year and a
-- gender, it can narrow a small tak to one person. Do not add anything finer, and keep access to
-- this database in mind rather than only its contents.
--
-- Members are never deleted from here, even when their source row is gone: their row is what the
-- facts of a settled year join to for demographics, and removing one cascades into the registrations
-- of those years.
CREATE TABLE `members` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `birthYear` smallint DEFAULT NULL,
  `gender` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `postalCode` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `lastRegisteredAt` datetime DEFAULT NULL,
  `source` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sync' COMMENT 'Which pipeline produced this row: sync or import',
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  KEY `birthYear` (`birthYear`),
  KEY `gender` (`gender`),
  KEY `postalCode` (`postalCode`),
  KEY `source` (`source`),
  CONSTRAINT `members_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per member per group, so a member registered for several groups keeps one row per group.
-- Retention is answered by comparing these rows across periods, which is why they are kept at this
-- grain instead of being counted up front.
CREATE TABLE `registrations` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `memberId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `groupId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `periodId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `registeredAt` datetime DEFAULT NULL COMMENT 'Date of the registration or renewal. This is null if the registration is not yet active (e.g. during payment)',
  `startDate` datetime DEFAULT NULL,
  `endDate` datetime DEFAULT NULL,
  `trialUntil` datetime DEFAULT NULL,
  `deactivatedAt` datetime DEFAULT NULL COMMENT 'Set if the registration was canceled or deactivated during the group cycle. Keep this null at the end of the group cycle.',
  `waitingList` tinyint(1) NOT NULL DEFAULT '0',
  `cycle` int NOT NULL COMMENT 'Cycle of the group the registration is for',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `source` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sync' COMMENT 'Which pipeline produced this row: sync or import',
  PRIMARY KEY (`id`),
  KEY `memberId` (`memberId`) USING BTREE,
  KEY `groupId` (`groupId`),
  KEY `organizationId` (`organizationId`),
  KEY `periodId` (`periodId`),
  KEY `registeredAt` (`registeredAt`),
  KEY `source` (`source`),
  CONSTRAINT `registrations_ibfk_1` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registrations_ibfk_2` FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registrations_ibfk_3` FOREIGN KEY (`periodId`) REFERENCES `registration_periods` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `registrations_ibfk_4` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Which lidgeld a member holds in a period. The price columns of the source are dropped: these
-- reports count members, not money.
CREATE TABLE `member_platform_memberships` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `memberId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `membershipTypeId` varchar(36) NOT NULL,
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `periodId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `startDate` datetime NOT NULL,
  `endDate` datetime NOT NULL,
  `expireDate` datetime DEFAULT NULL,
  `trialUntil` datetime DEFAULT NULL,
  `deletedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `source` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sync' COMMENT 'Which pipeline produced this row: sync or import',
  PRIMARY KEY (`id`),
  KEY `memberId` (`memberId`),
  KEY `membershipTypeId` (`membershipTypeId`),
  KEY `organizationId` (`organizationId`),
  KEY `periodId` (`periodId`),
  KEY `source` (`source`),
  CONSTRAINT `member_platform_memberships_ibfk_1` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `member_platform_memberships_ibfk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `member_platform_memberships_ibfk_3` FOREIGN KEY (`periodId`) REFERENCES `registration_periods` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `member_platform_memberships_ibfk_4` FOREIGN KEY (`membershipTypeId`) REFERENCES `platform_membership_types` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `member_responsibility_records` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `memberId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `groupId` varchar(36) DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `responsibilityId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `startDate` datetime NOT NULL,
  `endDate` datetime DEFAULT NULL,
  `source` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'sync' COMMENT 'Which pipeline produced this row: sync or import',
  PRIMARY KEY (`id`),
  KEY `memberId,organizationId` (`memberId`,`organizationId`) USING BTREE,
  KEY `responsibilityId` (`responsibilityId`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  KEY `groupId` (`groupId`),
  KEY `source` (`source`),
  CONSTRAINT `member_responsibility_records_ibfk_1` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `member_responsibility_records_ibfk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `member_responsibility_records_ibfk_3` FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `member_responsibility_records_ibfk_4` FOREIGN KEY (`responsibilityId`) REFERENCES `responsibilities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Bookkeeping for the sync job. One row per synced table, so every table advances on its own and a
-- table that fails keeps retrying from where it got to without holding up the others.
--
-- `watermark` is the highest `updatedAt` of the source rows that made it in. The next run reads from
-- slightly before it (see the overlap in the sync), which is what makes a crashed or half-finished
-- run harmless: rows are written again rather than skipped.
CREATE TABLE `stats_sync_state` (
  `tableName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `watermark` datetime DEFAULT NULL COMMENT 'Highest updatedAt of the source rows synced so far. Null means nothing was synced yet, which is also how a full backfill starts.',
  `lastSucceededAt` datetime DEFAULT NULL COMMENT 'End of the last incremental run that completed without an error',
  `lastReconciledAt` datetime DEFAULT NULL COMMENT 'End of the last run that reconciled deletes against the source table',
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`tableName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
