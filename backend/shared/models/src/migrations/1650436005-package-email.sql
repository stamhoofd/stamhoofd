ALTER TABLE `stamhoofd_packages`
ADD COLUMN `emailCount` int NOT NULL DEFAULT '0',
ADD COLUMN `lastEmailAt` datetime NULL;